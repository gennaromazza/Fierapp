import type { 
  SelectionRule, 
  RulesEvaluationResult,
  ItemState 
} from '../../../shared/rulesSchema';
import type { Item } from '../../../shared/schema';

/**
 * Motore principale per la valutazione delle regole di selezione
 * Gestisce la logica core per determinare disponibilità e trasformazioni regalo
 */
export class RulesEngine {
  private rules: SelectionRule[];
  private allItems: Item[];

  constructor(rules: SelectionRule[], allItems: Item[]) {
    this.rules = rules.filter(rule => rule.active).sort((a, b) => a.priority - b.priority);
    this.allItems = allItems;
  }

  /**
   * Valuta tutte le regole attive per un carrello specifico
   * @param selectedItems - Item attualmente selezionati nel carrello
   * @returns Risultato della valutazione con stati aggiornati
   */
  evaluate(selectedItems: Item[]): RulesEvaluationResult {
    const itemStates: Record<string, ItemState> = {};
    const appliedRules: string[] = [];
    const conflicts: any[] = [];

    // Inizializza stato base per tutti gli item
    // I servizi sono sempre disponibili, le regole si applicano solo ai prodotti
    this.allItems.forEach(item => {
      itemStates[item.id] = {
        itemId: item.id,
        isAvailable: true, // Services always available initially
        isGift: false,
        originalPrice: item.price,
        appliedRules: [],
      };
    });

    const selectedItemIds = selectedItems.map(item => item.id);

    // Prima passa: regole di disponibilità (escluso esclusione mutua)
    this.rules
      .filter(rule => rule.type === 'availability' && rule.conditions.type !== 'mutually_exclusive')
      .forEach(rule => {
        const conditionMet = this.evaluateCondition(rule.conditions, selectedItems, selectedItemIds);
        
        // Per regole di disponibilità con azione "disable":
        // - Se condizione è SODDISFATTA → item disponibile 
        // - Se condizione NON è soddisfatta → item NON disponibile (disable)
        if (rule.action === 'disable') {
          if (!conditionMet) {
            // Condizione non soddisfatta → applica disable
            appliedRules.push(rule.id);
            this.applyRule(rule, itemStates, selectedItemIds);
          }
        } else {
          // Per altre azioni (enable), logica normale
          if (conditionMet) {
            appliedRules.push(rule.id);
            this.applyRule(rule, itemStates, selectedItemIds);
          }
        }
      });

    // Gestione esclusione mutua basata su regole
    this.rules
      .filter(rule => rule.type === 'availability' && rule.conditions.type === 'mutually_exclusive')
      .forEach(rule => {
        // Se uno degli elementi mutualmente esclusivi è selezionato, disabilita gli altri target
        if (rule.conditions.mutuallyExclusiveWith?.some(itemId => selectedItemIds.includes(itemId))) {
          rule.targetItems.forEach(targetItemId => {
            if (!selectedItemIds.includes(targetItemId)) {
              itemStates[targetItemId].isAvailable = false;
              itemStates[targetItemId].appliedRules.push(rule.id);
            }
          });
          appliedRules.push(rule.id);
        }
      });

    // Seconda passa: regole di trasformazione regalo
    this.rules
      .filter(rule => rule.type === 'gift_transformation')
      .forEach(rule => {
        const conditionMet = this.evaluateCondition(rule.conditions, selectedItems, selectedItemIds);
        console.log(`🎁 Gift rule "${rule.name}": condition=${conditionMet}`);
        if (conditionMet) {
          appliedRules.push(rule.id);
          this.applyRule(rule, itemStates, selectedItemIds);
        }
      });

    return {
      itemStates,
      appliedRules,
      conflicts,
    };
  }

  /**
   * Valuta se una specifica condizione è soddisfatta
   * @param condition - Condizione da valutare
   * @param selectedItems - Item selezionati
   * @param selectedItemIds - Array degli ID selezionati per performance
   * @returns true se la condizione è soddisfatta
   */
  public evaluateCondition(
    condition: SelectionRule['conditions'], 
    selectedItems: Item[], 
    selectedItemIds: string[]
  ): boolean {
    switch (condition.type) {
      case 'min_selection_count':
        return this.evaluateMinSelectionCount(condition, selectedItems);
        
      case 'specific_items':
        return this.evaluateSpecificItems(condition, selectedItemIds);
        
      case 'required_items':
        return this.evaluateRequiredItems(condition, selectedItemIds);
        
      case 'category_count':
        return this.evaluateCategoryCount(condition, selectedItems);
        
      case 'mutually_exclusive':
        return this.evaluateMutuallyExclusive(condition, selectedItemIds);
        
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Valuta condizione di conteggio minimo selezioni
   */
  private evaluateMinSelectionCount(
    condition: SelectionRule['conditions'], 
    selectedItems: Item[]
  ): boolean {
    const targetValue = condition.value || 0;
    
    if (condition.categories && condition.categories.length > 0) {
      // Conta solo item delle categorie specificate
      const categoryCount = selectedItems.filter(item => 
        condition.categories!.includes(item.category)
      ).length;
      return categoryCount >= targetValue;
    } else {
      // Conta tutti gli item selezionati
      return selectedItems.length >= targetValue;
    }
  }

  /**
   * Valuta condizione di item specifici
   */
  private evaluateSpecificItems(
    condition: SelectionRule['conditions'], 
    selectedItemIds: string[]
  ): boolean {
    if (!condition.specificItems || condition.specificItems.length === 0) {
      return false;
    }
    
    // Verifica che almeno uno degli item specificati sia selezionato
    return condition.specificItems.some(itemId => 
      selectedItemIds.includes(itemId)
    );
  }

  /**
   * Valuta condizione di item richiesti
   */
  private evaluateRequiredItems(
    condition: SelectionRule['conditions'], 
    selectedItemIds: string[]
  ): boolean {
    if (!condition.requiredItems || condition.requiredItems.length === 0) {
      return false;
    }
    
    const selectedRequiredItems = condition.requiredItems.filter(itemId =>
      selectedItemIds.includes(itemId)
    );
    
    console.log("📊 Required Items Check:", {
      required: condition.requiredItems.length,
      selected: selectedRequiredItems.length,
      requiredIds: condition.requiredItems,
      selectedIds: selectedItemIds,
      minimumCount: condition.minimumCount
    });
    
    if (condition.minimumCount && condition.minimumCount > 0) {
      // Almeno N degli item richiesti devono essere selezionati
      return selectedRequiredItems.length >= condition.minimumCount;
    } else {
      // Tutti gli item richiesti devono essere selezionati
      return selectedRequiredItems.length === condition.requiredItems.length;
    }
  }

  /**
   * Valuta condizione di conteggio categoria
   */
  private evaluateCategoryCount(
    condition: SelectionRule['conditions'], 
    selectedItems: Item[]
  ): boolean {
    if (!condition.categories || !condition.value) {
      return false;
    }
    
    const count = selectedItems.filter(item => 
      condition.categories!.includes(item.category)
    ).length;
    
    return count >= condition.value;
  }

  /**
   * Valuta condizione di esclusione mutua
   */
  private evaluateMutuallyExclusive(
    condition: SelectionRule['conditions'],
    selectedItemIds: string[]
  ): boolean {
    if (!condition.mutuallyExclusiveWith || condition.mutuallyExclusiveWith.length === 0) {
      return false;
    }
    
    // Restituisce true se almeno uno degli item mutualmente esclusivi è selezionato
    return condition.mutuallyExclusiveWith.some(itemId => 
      selectedItemIds.includes(itemId)
    );
  }

  /**
   * Applica una regola agli stati degli item
   */
  private applyRule(
    rule: SelectionRule, 
    itemStates: Record<string, ItemState>,
    selectedItemIds: string[]
  ): void {
    rule.targetItems.forEach(targetItemId => {
      const currentState = itemStates[targetItemId];
      if (!currentState) {
        console.warn(`Target item ${targetItemId} not found in states`);
        return;
      }
      
      // Don't apply availability rules to services - they're always available
      const targetItem = this.allItems.find(item => item.id === targetItemId);
      if (targetItem?.category === 'servizio' && rule.type === 'availability') {
        console.log(`⚠️ Skipping availability rule for service: ${targetItem.title}`);
        return; // Skip availability rules for services
      }
      
      switch (rule.action) {
        case 'disable':
          currentState.isAvailable = false;
          break;
          
        case 'enable':
          currentState.isAvailable = true;
          break;
          
        case 'make_gift':
          // Rende SEMPRE regalo quando la condizione è soddisfatta
          // Non serve che sia già nel carrello
          currentState.isGift = true;
          currentState.giftSettings = rule.giftSettings || {
            showOriginalPrice: true,
            giftText: 'OMAGGIO!',
            giftBadgeColor: 'bg-green-600'
          };
          console.log(`🎁 Applied gift to ${targetItemId}:`, rule.name);
          break;
          
        default:
          console.warn(`Unknown action: ${rule.action}`);
      }
      
      currentState.appliedRules.push(rule.id);
    });
  }

  /**
   * Ottiene informazioni di debug sulle regole applicate
   */
  getDebugInfo(selectedItems: Item[]): any {
    const result = this.evaluate(selectedItems);
    const selectedItemIds = selectedItems.map(item => item.id);
    
    const evaluatedConditions = this.rules.map(rule => {
      const conditionMet = this.evaluateCondition(rule.conditions, selectedItems, selectedItemIds);
      const willApply = rule.action === 'disable' ? !conditionMet : conditionMet;
      
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        conditionMet,
        conditionType: rule.conditions.type,
        action: rule.action,
        willApply,
        targetItems: rule.targetItems,
      };
    });

    return {
      totalRules: this.rules.length,
      activeRules: this.rules.filter(rule => rule.active).length,
      evaluatedConditions,
      itemStates: result.itemStates,
      appliedRules: result.appliedRules,
    };
  }
}