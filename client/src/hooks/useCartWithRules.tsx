import { useCart } from './useCart';
import { useSelectionRules } from './useSelectionRules';
import { RulesEngine } from '../lib/rulesEngine';
import { useMemo, useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Item, CartItem } from '../../../shared/schema';
import type { RulesEvaluationResult, ItemState, SelectionRule } from '../../../shared/rulesSchema';
import type { NotificationItem } from '../components/GiftNotification';
import { toast } from '../hooks/use-toast';

/**
 * Hook esteso del carrello che integra le regole di selezione
 * Combina la logica del carrello base con la valutazione delle regole
 */
export function useCartWithRules() {
  // Hook base del carrello
  const cart = useCart();
  
  // Carica tutti gli item attivi
  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const itemsQuery = query(
        collection(db, "items"),
        where("isActive", "==", true),
        orderBy("category", "asc"),
        orderBy("sortOrder", "asc")
      );
      
      const snapshot = await getDocs(itemsQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Item;
      });
    },
  });
  
  // Regole di selezione
  const { rules, loading: rulesLoading } = useSelectionRules();

  // Valutazione delle regole in tempo reale
  const rulesEvaluation = useMemo((): RulesEvaluationResult => {
    if (itemsLoading || rulesLoading || !allItems.length) {
      // Stato di caricamento - tutti disponibili per default
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

    // Converte CartItem a Item per la valutazione delle regole
    const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
      const fullItem = allItems.find(item => item.id === cartItem.id);
      return fullItem || {
        ...cartItem,
        active: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    
    const rulesEngine = new RulesEngine(rules, allItems);
    const evaluation = rulesEngine.evaluate(cartAsItems);
    
    // Debug per vedere quando le regole regalo si attivano
    console.log("🎁 Rules Evaluation:", {
      cartItems: cartAsItems.map(item => item.title),
      appliedRules: evaluation.appliedRules,
      giftItems: Object.entries(evaluation.itemStates)
        .filter(([_, state]) => state.isGift)
        .map(([id, state]) => {
          const item = allItems.find(i => i.id === id);
          return { id, title: item?.title, state };
        })
    });
    
    return evaluation;
  }, [cart.cart.items, rules, allItems, itemsLoading, rulesLoading]);

  // Rimuovi automaticamente gli item non disponibili dal carrello
  useEffect(() => {
    if (itemsLoading || rulesLoading) return;
    
    // Raccogli gli item da rimuovere
    const itemsToRemove: string[] = [];
    
    cart.cart.items.forEach((cartItem: CartItem) => {
      const itemState = rulesEvaluation.itemStates[cartItem.id];
      
      // Se l'item esiste nelle regole e non è più disponibile
      if (itemState && !itemState.isAvailable) {
        itemsToRemove.push(cartItem.id);
        console.log(`🚮 Rimuovo automaticamente ${cartItem.title} dal carrello (non più disponibile)`);
      }
    });
    
    // Rimuovi tutti gli item non disponibili in una sola volta
    if (itemsToRemove.length > 0) {
      // Usa setTimeout per evitare aggiornamenti durante il rendering
      setTimeout(() => {
        itemsToRemove.forEach(itemId => {
          cart.removeItem(itemId);
        });
      }, 0);
    }
  }, [rulesEvaluation.itemStates]); // Dipende solo dallo stato delle regole, non dagli item del carrello

  // Tracking per prodotti sbloccati
  const previousAvailabilityRef = useRef<Record<string, boolean>>({});

  // Monitora i cambiamenti di disponibilità per mostrare toast di prodotti sbloccati
  useEffect(() => {
    if (itemsLoading || rulesLoading || !allItems.length) return;

    const newlyUnlockedItems: Item[] = [];
    const currentAvailability: Record<string, boolean> = {};

    // Controlla ogni item per vedere se è appena diventato disponibile
    allItems.forEach(item => {
      const isCurrentlyAvailable = rulesEvaluation.itemStates[item.id]?.isAvailable ?? true;
      const wasPreviouslyAvailable = previousAvailabilityRef.current[item.id] ?? true;
      
      currentAvailability[item.id] = isCurrentlyAvailable;

      // Se l'item ora è disponibile ma prima non lo era
      if (isCurrentlyAvailable && !wasPreviouslyAvailable) {
        newlyUnlockedItems.push(item);
      }
    });

    // Mostra toast se ci sono prodotti appena sbloccati
    if (newlyUnlockedItems.length > 0) {
      const productNames = newlyUnlockedItems.map(item => item.title).join(', ');
      const message = newlyUnlockedItems.length === 1 
        ? `Ora puoi selezionare: ${productNames}`
        : `Ora puoi selezionare: ${productNames}`;

      toast({
        title: "🔓 Prodotti Sbloccati!",
        description: message,
        duration: 5000,
      });

      console.log("🔓 Prodotti sbloccati:", newlyUnlockedItems.map(item => item.title));
    }

    // Aggiorna il riferimento per il prossimo confronto
    previousAvailabilityRef.current = currentAvailability;
  }, [rulesEvaluation.itemStates, allItems, itemsLoading, rulesLoading]);

  // Funzione per verificare se un item è disponibile per la selezione
  const isItemAvailable = (itemId: string): boolean => {
    const itemState = rulesEvaluation.itemStates[itemId];
    return itemState ? itemState.isAvailable : true;
  };

  // Funzione per verificare se un item è un regalo
  const isItemGift = (itemId: string): boolean => {
    const itemState = rulesEvaluation.itemStates[itemId];
    return itemState ? itemState.isGift : false;
  };

  // Funzione per ottenere le impostazioni regalo di un item
  const getItemGiftSettings = (itemId: string) => {
    const itemState = rulesEvaluation.itemStates[itemId];
    return itemState?.giftSettings;
  };

  // Funzione per ottenere tutte le regole applicate a un item
  const getAppliedRules = (itemId: string): string[] => {
    const itemState = rulesEvaluation.itemStates[itemId];
    return itemState?.appliedRules || [];
  };

  // Override della funzione addItem per controllare disponibilità
  const addItemWithRules = (item: CartItem) => {
    if (!isItemAvailable(item.id)) {
      console.warn(`Item ${item.title} is not available due to selection rules`);
      return false;
    }
    
    cart.addItem(item);
    return true;
  };

  // Calcola il pricing con le regole di regalo e sconti globali applicati
  const getPricingWithRules = () => {
    const basePricing = {
      subtotal: cart.cart.subtotal,
      discount: cart.cart.discount,
      total: cart.cart.total
    };
    let adjustedSubtotal = 0;
    let giftSavings = 0;

    cart.cart.items.forEach((item: CartItem) => {
      if (isItemGift(item.id)) {
        // Item è un regalo - aggiungi ai risparmi
        giftSavings += item.price;
      } else {
        // Item normale - aggiungi al subtotale
        adjustedSubtotal += item.price;
      }
    });

    // Recupera sconti globali da localStorage come fa il PriceBar (temporaneo per sync)
    let globalDiscount = 0;
    
    try {
      const discountsDoc = localStorage.getItem('cachedDiscounts');
      if (discountsDoc) {
        const discounts = JSON.parse(discountsDoc);
        const hasGlobalDiscount = discounts?.global?.isActive;
        
        if (hasGlobalDiscount && discounts.global) {
          if (discounts.global.type === 'fixed') {
            globalDiscount = discounts.global.value || 0;
          } else if (discounts.global.type === 'percent') {
            // Per percentuali, calcola sulla base del subtotale già scontato
            globalDiscount = Math.round(adjustedSubtotal * ((discounts.global.value || 0) / 100));
          }
        }
      }
    } catch (error) {
      console.warn("Error loading global discounts for pricing calculation:", error);
    }

    // Il totale finale è: subtotale scontato - sconto globale
    // Non sommare gli sconti esistenti perché sono già stati applicati nel adjustedSubtotal
    const finalTotal = Math.max(0, adjustedSubtotal - globalDiscount);
    
    // Calcola i risparmi totali: differenza tra originale e finale + regali
    const totalSavings = (basePricing.subtotal - finalTotal) + giftSavings;
    

    
    return {
      subtotal: adjustedSubtotal,
      originalSubtotal: basePricing.subtotal,
      discount: globalDiscount, // Solo lo sconto globale applicato qui
      giftSavings,
      total: finalTotal,
      totalSavings,
    };
  };

  // Lista degli item nel carrello con informazioni sulle regole
  const getItemsWithRuleInfo = () => {
    return cart.cart.items.map((item: CartItem) => ({
      ...item,
      isGift: isItemGift(item.id),
      giftSettings: getItemGiftSettings(item.id),
      appliedRules: getAppliedRules(item.id),
      finalPrice: isItemGift(item.id) ? 0 : item.price,
    }));
  };

  // Lista di tutti gli item con stato di disponibilità
  const getAllItemsWithAvailability = () => {
    return allItems.map((item: Item) => ({
      ...item,
      isAvailable: isItemAvailable(item.id),
      isGift: isItemGift(item.id),
      giftSettings: getItemGiftSettings(item.id),
      appliedRules: getAppliedRules(item.id),
    }));
  };

  // Debug info per sviluppo
  const getDebugInfo = () => {
    if (itemsLoading || rulesLoading) {
      return {
        loading: true,
        itemsLoading,
        rulesLoading,
        rulesCount: rules.length
      };
    }
    
    // Converte CartItem a Item per debug
    const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
      const fullItem = allItems.find(item => item.id === cartItem.id);
      return fullItem || {
        ...cartItem,
        active: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Item;
    });
    
    const rulesEngine = new RulesEngine(rules, allItems);
    const engineDebug = rulesEngine.getDebugInfo(cartAsItems);
    
    return {
      ...engineDebug,
      loadedRules: rules.length,
      cartItems: cartAsItems.length,
      selectedItemIds: cartAsItems.map(item => item.id),
    };
  };

  // Ottiene il motivo per cui un item non è disponibile o ha comportamenti speciali
  const getUnavailableReason = (itemId: string): string => {
    if (rulesLoading || itemsLoading) return "Caricamento...";
    
    try {
      const rulesEngine = new RulesEngine(rules, allItems);
      const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
        const fullItem = allItems.find(item => item.id === cartItem.id);
        return fullItem || {
          ...cartItem,
          active: true,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Item;
      });
      
      // Controlla tutte le regole che influenzano questo item
      const applicableRules = rules.filter(rule => 
        rule.active && rule.targetItems.includes(itemId)
      );
      
      for (const rule of applicableRules) {
        const conditionMet = rulesEngine.evaluateCondition(rule.conditions, cartAsItems, cartAsItems.map(i => i.id));
        
        // Logica specifica per tipo di regola e azione
        let shouldShowReason = false;
        
        if (rule.type === 'availability') {
          if (rule.action === 'disable') {
            // Per regole disable, controlla il tipo di condizione
            if (rule.conditions.type === 'mutually_exclusive') {
              // Per mutua esclusione, mostra il motivo quando la condizione è soddisfatta (prodotto conflittuale presente)
              shouldShowReason = conditionMet;
            } else {
              // Per altre condizioni, mostra il motivo quando NON soddisfatta
              shouldShowReason = !conditionMet;
            }
          } else if (rule.action === 'enable' && conditionMet) {
            shouldShowReason = true; // Regola enable attiva quando condizione soddisfatta
          }
        } else if (rule.type === 'gift_transformation') {
          if (rule.action === 'make_gift' && conditionMet) {
            // Per regali, potremmo voler mostrare un messaggio informativo
            return generateConditionMessage(rule, allItems, false, 'gift');
          }
        }
        
        if (shouldShowReason) {
          return generateConditionMessage(rule, allItems, !conditionMet);
        }
      }
      
      return "Non disponibile";
    } catch (error) {
      console.error('Error in getUnavailableReason:', error);
      return "Non disponibile";
    }
  };

  // Genera messaggio basato sulla condizione della regola
  const generateConditionMessage = (
    rule: SelectionRule, 
    allItems: Item[], 
    isNegated: boolean = false,
    messageType: 'unavailable' | 'gift' = 'unavailable'
  ): string => {
    const prefix = messageType === 'gift' ? 'Regalo per:' : 'Richiede:';
    
    switch (rule.conditions.type) {
      case 'required_items':
        if (rule.conditions.requiredItems && rule.conditions.requiredItems.length > 0) {
          const requiredItemNames = rule.conditions.requiredItems.map((itemId: string) => {
            const item = allItems.find(i => i.id === itemId);
            return item?.title || 'Prodotto sconosciuto';
          });
          
          if (requiredItemNames.length === 1) {
            return `${prefix} ${requiredItemNames[0]}`;
          } else {
            return `${prefix} ${requiredItemNames.join(', ')}`;
          }
        }
        break;
        
      case 'min_selection_count':
        const count = rule.conditions.value || 1;
        if (messageType === 'gift') {
          return `Regalo per ${count}+ selezioni`;
        }
        return `Seleziona almeno ${count} prodotti`;
        
      case 'category_count':
        if (rule.conditions.categories && rule.conditions.categories.length > 0) {
          const count = rule.conditions.value || 1;
          const categories = rule.conditions.categories.join(', ');
          if (messageType === 'gift') {
            return `Regalo per ${count} da: ${categories}`;
          }
          return `Seleziona ${count} da: ${categories}`;
        }
        return messageType === 'gift' ? 'Regalo per categoria' : 'Seleziona più prodotti nella categoria';
        
      case 'specific_items':
        if (rule.conditions.specificItems && rule.conditions.specificItems.length > 0) {
          const itemNames = rule.conditions.specificItems.map((itemId: string) => {
            const item = allItems.find(i => i.id === itemId);
            return item?.title || 'Prodotto sconosciuto';
          });
          return `${prefix} ${itemNames.join(' o ')}`;
        }
        break;
        
      case 'mutually_exclusive':
        if (rule.conditions.mutuallyExclusiveWith && rule.conditions.mutuallyExclusiveWith.length > 0) {
          const exclusiveItemNames = rule.conditions.mutuallyExclusiveWith.map((itemId: string) => {
            const item = allItems.find(i => i.id === itemId);
            return item?.title || 'Prodotto sconosciuto';
          });
          
          if (exclusiveItemNames.length === 1) {
            return `Non disponibile con: ${exclusiveItemNames[0]}`;
          } else {
            return `Non disponibile con: ${exclusiveItemNames.join(', ')}`;
          }
        }
        break;
        
      default:
        return rule.description || (messageType === 'gift' ? "Regalo speciale" : "Non disponibile");
    }
    
    return rule.description || (messageType === 'gift' ? "Regalo speciale" : "Non disponibile");
  };

  // Ottiene gli ID degli item richiesti per un item non disponibile
  const getRequiredItemIds = (itemId: string): string[] => {
    if (rulesLoading || itemsLoading) return [];
    
    try {
      const rulesEngine = new RulesEngine(rules, allItems);
      const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
        const fullItem = allItems.find(item => item.id === cartItem.id);
        return fullItem || {
          ...cartItem,
          active: true,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Item;
      });
      
      // Controlla tutte le regole che influenzano questo item
      const applicableRules = rules.filter(rule => 
        rule.active && rule.targetItems.includes(itemId)
      );
      
      for (const rule of applicableRules) {
        const conditionMet = rulesEngine.evaluateCondition(rule.conditions, cartAsItems, cartAsItems.map(i => i.id));
        
        if (rule.type === 'availability' && rule.action === 'disable' && !conditionMet) {
          // Restituisce gli ID degli item richiesti per questa regola
          if (rule.conditions.type === 'required_items' && rule.conditions.requiredItems) {
            return rule.conditions.requiredItems.filter(id => !cartAsItems.map(i => i.id).includes(id));
          }
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error in getRequiredItemIds:', error);
      return [];
    }
  };

  return {
    // Tutte le funzioni e proprietà del carrello base
    ...cart,
    
    // Override di addItem con controllo regole
    addItem: addItemWithRules,
    
    // Nuove funzioni per le regole
    isItemAvailable,
    isItemGift,
    getItemGiftSettings,
    getUnavailableReason,
    getAppliedRules,
    getPricingWithRules,
    getItemsWithRuleInfo,
    getAllItemsWithAvailability,
    getRequiredItemIds,
    
    // Dati delle regole
    rulesEvaluation,
    appliedRules: rulesEvaluation.appliedRules,
    
    // Loading states
    rulesLoading: rulesLoading || itemsLoading,
    
    // Debug (solo in development)
    ...(process.env.NODE_ENV === 'development' && { getDebugInfo }),
  };
}