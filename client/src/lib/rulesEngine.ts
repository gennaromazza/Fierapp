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
    this.allItems.forEach(item => {
      itemStates[item.id] = {
        itemId: item.id,
        isAvailable: true,
        isGift: false,
        originalPrice: item.price,
        appliedRules: [],
      };
    });

    const selectedItemIds = selectedItems.map(item => item.id);

    // Prima passa: regole di disponibilità
    this.rules
      .filter(rule => rule.type === 'availability')
      .forEach(rule => {
        if (this.evaluateCondition(rule.conditions, selectedItems, selectedItemIds)) {
          appliedRules.push(rule.id);
          this.applyRule(rule, itemStates, selectedItemIds);
        }
      });

    // Seconda passa: regole di trasformazione regalo
    this.rules
      .filter(rule => rule.type === 'gift_transformation')
      .forEach(rule => {
        if (this.evaluateCondition(rule.conditions, selectedItems, selectedItemIds)) {
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
  private evaluateCondition(
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
      
      switch (rule.action) {
        case 'disable':
          currentState.isAvailable = false;
          break;
          
        case 'enable':
          currentState.isAvailable = true;
          break;
          
        case 'make_gift':
          // Solo se l'item è nel carrello
          if (selectedItemIds.includes(targetItemId)) {
            currentState.isGift = true;
            currentState.giftSettings = rule.giftSettings;
          }
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
  getDebugInfo(selectedItems: Item[]): {
    totalRules: number;
    activeRules: number;
    evaluatedConditions: Array<{
      ruleId: string;
      ruleName: string;
      conditionMet: boolean;
      conditionType: string;
    }>;
  } {
    const selectedItemIds = selectedItems.map(item => item.id);
    
    const evaluatedConditions = this.rules.map(rule => ({
      ruleId: rule.id,
      ruleName: rule.name,
      conditionMet: this.evaluateCondition(rule.conditions, selectedItems, selectedItemIds),
      conditionType: rule.conditions.type,
    }));

    return {
      totalRules: this.rules.length,
      activeRules: this.rules.filter(rule => rule.active).length,
      evaluatedConditions,
    };
  }
}