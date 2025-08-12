import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useEffect, useState } from 'react';
import type { 
  SelectionRule, 
  InsertSelectionRule,
  RulesEvaluationResult,
  ItemState 
} from '../../../shared/rulesSchema';
import type { Item } from '../../../shared/schema';

// Hook per gestire le regole di selezione
export function useSelectionRules() {
  const [rules, setRules] = useState<SelectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Carica le regole attive (accessibile anche agli ospiti)
  useEffect(() => {
    async function loadRules() {
      try {
        console.log('📡 Loading selection rules...');
        
        // Usa getDocs invece di onSnapshot per evitare problemi di permessi con ospiti
        const rulesQuery = query(
          collection(db, "selection_rules"),
          where("active", "==", true)
        );

        const snapshot = await getDocs(rulesQuery);
        console.log('🔥 Selection Rules loaded:', snapshot.docs.length, 'documents');
        
        const rulesData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('📋 Raw rule data:', doc.id, data);
          
          // Converte la regola dal formato semplificato (admin) al formato strutturato (engine)
          const convertedRule = convertAdminRuleToEngineRule({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
          
          return convertedRule;
        });
        
        // Ordina manualmente per priorità
        rulesData.sort((a, b) => (a.priority || 1) - (b.priority || 1));
        
        console.log('✅ Processed rules:', rulesData);
        setRules(rulesData);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading selection rules:', error);
        // In caso di errore (es. permessi), continua senza regole
        console.log('🔄 Continuing without rules (guest mode)');
        setRules([]);
        setLoading(false);
      }
    }

    loadRules();
    
    // Ricarica ogni 30 secondi per aggiornamenti (per ospiti)
    const interval = setInterval(loadRules, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Mutation per creare nuova regola
  const createRule = useMutation({
    mutationFn: async (newRule: InsertSelectionRule) => {
      const docRef = await addDoc(collection(db, "selection_rules"), {
        ...newRule,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selection_rules'] });
    },
  });

  // Mutation per aggiornare regola
  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SelectionRule> }) => {
      await updateDoc(doc(db, "selection_rules", id), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selection_rules'] });
    },
  });

  // Mutation per eliminare regola
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "selection_rules", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selection_rules'] });
    },
  });

  return {
    rules,
    loading,
    createRule,
    updateRule,
    deleteRule,
  };
}

// Funzione per convertire regola dal formato admin al formato engine
function convertAdminRuleToEngineRule(adminRule: any): SelectionRule {
  console.log('🔄 Converting admin rule:', adminRule);
  
  // Se la regola ha già il formato corretto (con conditions), usala direttamente
  if (adminRule.conditions && typeof adminRule.conditions === 'object') {
    console.log('✅ Rule already in engine format');
    return adminRule as SelectionRule;
  }
  
  // Conversione dal formato semplificato (admin) al formato strutturato (engine)
  let conditions;
  
  // Se ha requiredItems (array di ID), crea condizione required_items
  if (adminRule.requiredItems && Array.isArray(adminRule.requiredItems) && adminRule.requiredItems.length > 0) {
    conditions = {
      type: "required_items" as const,
      requiredItems: adminRule.requiredItems,
    };
    console.log('🔧 Created required_items condition:', conditions);
  } 
  // Se ha targetItems ma non requiredItems, usa specific_items  
  else if (adminRule.targetItems && Array.isArray(adminRule.targetItems) && adminRule.targetItems.length > 0) {
    conditions = {
      type: "specific_items" as const,
      specificItems: adminRule.targetItems,
    };
    console.log('🔧 Created specific_items condition:', conditions);
  }
  // Fallback - nessuna condizione valida
  else {
    conditions = {
      type: "min_selection_count" as const,
      value: 1,
    };
    console.log('⚠️ Using fallback condition:', conditions);
  }
  
  const convertedRule = {
    id: adminRule.id,
    name: adminRule.name || 'Regola senza nome',
    description: adminRule.description || '',
    type: adminRule.type || 'availability',
    active: adminRule.active !== false, // default true
    priority: adminRule.priority || 1,
    conditions,
    targetItems: adminRule.targetItems || [],
    action: adminRule.action || 'disable',
    giftSettings: adminRule.giftSettings,
    createdAt: adminRule.createdAt || new Date(),
    updatedAt: adminRule.updatedAt || new Date(),
  } as SelectionRule;
  
  console.log('✅ Converted rule:', convertedRule);
  return convertedRule;
}

// Hook per valutare le regole su un carrello specifico
export function useRulesEvaluation(selectedItems: Item[], allItems: Item[]) {
  const { rules, loading: rulesLoading } = useSelectionRules();
  
  // Valuta le regole e restituisce lo stato aggiornato degli item
  const evaluateRules = (): RulesEvaluationResult => {
    if (rulesLoading || !rules.length) {
      // Nessuna regola o caricamento in corso - tutti gli item disponibili
      const itemStates: Record<string, ItemState> = {};
      allItems.forEach(item => {
        itemStates[item.id] = {
          itemId: item.id,
          isAvailable: true,
          isGift: false,
          appliedRules: [],
        };
      });
      
      return {
        itemStates,
        appliedRules: [],
        conflicts: [],
      };
    }

    const itemStates: Record<string, ItemState> = {};
    const appliedRules: string[] = [];
    const conflicts: any[] = [];

    // Inizializza stato base per tutti gli item
    allItems.forEach(item => {
      itemStates[item.id] = {
        itemId: item.id,
        isAvailable: true,
        isGift: false,
        originalPrice: item.price,
        appliedRules: [],
      };
    });

    const selectedItemIds = selectedItems.map(item => item.id);

    // Applica regole in ordine di priorità
    rules.forEach(rule => {
      if (!rule.active) return;

      const conditionMet = evaluateCondition(rule.conditions, selectedItems, selectedItemIds);
      
      if (conditionMet) {
        appliedRules.push(rule.id);
        
        // Applica azione ai target items
        rule.targetItems.forEach(targetItemId => {
          if (!itemStates[targetItemId]) return;
          
          const currentState = itemStates[targetItemId];
          
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
          }
          
          currentState.appliedRules.push(rule.id);
        });
      }
    });

    return {
      itemStates,
      appliedRules,
      conflicts,
    };
  };

  return {
    evaluateRules,
    loading: rulesLoading,
  };
}

// Funzione per valutare se una condizione è soddisfatta
function evaluateCondition(
  condition: SelectionRule['conditions'], 
  selectedItems: Item[], 
  selectedItemIds: string[]
): boolean {
  switch (condition.type) {
    case 'min_selection_count':
      if (condition.categories && condition.categories.length > 0) {
        // Conta solo item delle categorie specificate
        const categoryCount = selectedItems.filter(item => 
          condition.categories!.includes(item.category)
        ).length;
        return categoryCount >= (condition.value || 0);
      } else {
        // Conta tutti gli item selezionati
        return selectedItems.length >= (condition.value || 0);
      }
      
    case 'specific_items':
      // Verifica che almeno uno degli item specificati sia selezionato
      return condition.specificItems?.some(itemId => 
        selectedItemIds.includes(itemId)
      ) || false;
      
    case 'required_items':
      if (!condition.requiredItems) return false;
      
      if (condition.minimumCount && condition.minimumCount > 0) {
        // Almeno N degli item richiesti devono essere selezionati
        const requiredSelectedCount = condition.requiredItems.filter(itemId =>
          selectedItemIds.includes(itemId)
        ).length;
        return requiredSelectedCount >= condition.minimumCount;
      } else {
        // Tutti gli item richiesti devono essere selezionati
        return condition.requiredItems.every(itemId =>
          selectedItemIds.includes(itemId)
        );
      }
      
    case 'category_count':
      if (!condition.categories || !condition.value) return false;
      
      // Conta quanti item delle categorie specificate sono selezionati
      const count = selectedItems.filter(item => 
        condition.categories!.includes(item.category)
      ).length;
      return count >= condition.value;
      
    default:
      return false;
  }
}