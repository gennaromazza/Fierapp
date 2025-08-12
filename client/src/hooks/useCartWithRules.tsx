import { useCart } from './useCart';
import { useSelectionRules } from './useSelectionRules';
import { RulesEngine } from '../lib/rulesEngine';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Item, CartItem } from '../../../shared/schema';
import type { RulesEvaluationResult, ItemState } from '../../../shared/rulesSchema';

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
        where("active", "==", true),
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
    return rulesEngine.evaluate(cartAsItems);
  }, [cart.cart.items, rules, allItems, itemsLoading, rulesLoading]);

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

  // Calcola il pricing con le regole di regalo applicate
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

    // Applica sconti solo sui prezzi non-regalo
    const discountAmount = basePricing.subtotal > 0 ? (basePricing.discount / basePricing.subtotal) * adjustedSubtotal : 0;
    
    return {
      subtotal: adjustedSubtotal,
      originalSubtotal: basePricing.subtotal,
      discount: discountAmount,
      giftSavings,
      total: adjustedSubtotal - discountAmount,
      totalSavings: discountAmount + giftSavings,
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

  return {
    // Tutte le funzioni e proprietà del carrello base
    ...cart,
    
    // Override di addItem con controllo regole
    addItem: addItemWithRules,
    
    // Nuove funzioni per le regole
    isItemAvailable,
    isItemGift,
    getItemGiftSettings,
    getAppliedRules,
    getPricingWithRules,
    getItemsWithRuleInfo,
    getAllItemsWithAvailability,
    
    // Dati delle regole
    rulesEvaluation,
    appliedRules: rulesEvaluation.appliedRules,
    
    // Loading states
    rulesLoading: rulesLoading || itemsLoading,
    
    // Debug (solo in development)
    ...(process.env.NODE_ENV === 'development' && { getDebugInfo }),
  };
}