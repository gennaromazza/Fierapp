import { useCart } from "./useCart";
import { useSelectionRules } from "./useSelectionRules";
import { RulesEngine } from "../lib/rulesEngine";
import { calculateUnifiedPricing } from "../lib/unifiedPricing";
import { useMemo, useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Item, CartItem, Discounts } from "../../../shared/schema";
import type {
  RulesEvaluationResult,
  ItemState,
  SelectionRule,
} from "../../../shared/rulesSchema";
import { toast } from "./use-toast";

export function useCartWithRules() {
  // Carrello base
  const cart = useCart();

  /**
   * FETCH ITEMS — allineato a Carousel:
   * - where("active","==",true)
   * - ordinamento manuale su sortOrder (ASC)
   */
  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "active"],
    queryFn: async () => {
      try {
        const itemsQuery = query(
          collection(db, "items"),
          where("active", "==", true),
        );
        const snapshot = await getDocs(itemsQuery);

        const items = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data,
            createdAt: data?.createdAt?.toDate?.() ?? undefined,
            updatedAt: data?.updatedAt?.toDate?.() ?? undefined,
          } as Item;
        });

        // Ordinamento manuale come nel Carousel
        items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        console.info(
          "🔥 DynamicChatGuide loaded items",
          items.length,
          items.map((i) => i.title),
        );
        return items;
      } catch (error: any) {
        console.error("Error loading items:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare gli elementi. Riprova più tardi.",
          variant: "destructive",
        });
        return [];
      }
    },
  });

  /**
   * REGOLE DI SELEZIONE
   */
  const { rules: selectionRules = [] } = useSelectionRules();
  const rulesLoading = false; // Since useSelectionRules doesn't provide isLoading

  /**
   * FETCH DISCOUNTS da Firebase
   */
  const { data: discounts = null, isLoading: discountsLoading } = useQuery({
    queryKey: ["discounts"],
    queryFn: async () => {
      try {
        const discountsDoc = await getDoc(doc(db, "settings", "discounts"));
        if (discountsDoc.exists()) {
          const data = discountsDoc.data() as Discounts;
          console.log("📊 Loaded discounts:", data);
          return data;
        }
        return null;
      } catch (error) {
        console.error("Error loading discounts:", error);
        return null;
      }
    },
  });

  /**
   * VALUTAZIONE REGOLE tramite RulesEngine
   * Viene rivalutata automaticamente quando cambiano cart.items o selectionRules
   */
  const rulesEvaluation = useMemo<RulesEvaluationResult>(() => {
    const engine = new RulesEngine(selectionRules, allItems);
    const selectedItems = cart.cart.items.map(ci => 
      allItems.find(item => item.id === ci.id)
    ).filter(Boolean) as Item[];
    
    return engine.evaluate(selectedItems);
  }, [cart.cart.items, allItems, selectionRules]);

  /**
   * NOTIFICAZIONI DI REGALI SBLOCCATI
   * Mostra toast per nuovi regali quando il carrello cambia
   */
  const prevGiftItemsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentGiftItems = Object.entries(rulesEvaluation.itemStates)
      .filter(([id, state]) => (state as ItemState).isGift)
      .map(([id]) => id);

    const newGiftItems = currentGiftItems.filter(
      (id) => !prevGiftItemsRef.current.includes(id),
    );

    if (newGiftItems.length > 0 && prevGiftItemsRef.current.length > 0) {
      const giftTitles = newGiftItems
        .map((id) => allItems.find((item) => item.id === id)?.title)
        .filter(Boolean)
        .join(", ");

      toast({
        title: "🎁 Nuovo regalo sbloccato!",
        description: `${giftTitles} ${
          newGiftItems.length === 1 ? "è ora" : "sono ora"
        } gratuito!`,
        duration: 5000,
      });
    }

    prevGiftItemsRef.current = currentGiftItems;
  }, [rulesEvaluation.itemStates, allItems]);

  // METODI PUBBLICI per controllare disponibilità/regali
  const isItemAvailable = (itemId: string) =>
    rulesEvaluation.itemStates[itemId]?.isAvailable !== false;

  const isItemGift = (itemId: string) =>
    rulesEvaluation.itemStates[itemId]?.isGift || false;

  const getItemGiftSettings = (itemId: string) =>
    rulesEvaluation.itemStates[itemId]?.giftSettings;

  const getAppliedRules = (itemId: string) =>
    rulesEvaluation.itemStates[itemId]?.appliedRules || [];

  // addItem con controllo regole (mantiene la firma addItem)
  const addItemWithRules = (item: CartItem) => {
    if (!isItemAvailable(item.id)) {
      console.warn(
        `Item ${item.title} non disponibile per regole di selezione`,
      );
      return false;
    }
    cart.addItem(item);
    return true;
  };

  // Pricing unificato con regali + sconti (compatibile con PriceBar)
  const getPricingWithRules = () => {
    // Ottieni IDs degli item regalo
    const giftItemIds = cart.cart.items
      .filter(item => isItemGift(item.id))
      .map(item => item.id);
    
    // 🔧 RISOLUZIONE INCONSISTENZA: Usa i veri sconti invece di null!
    const unified = calculateUnifiedPricing(cart.cart.items, discounts, giftItemIds);
    
    // Mantieni compatibilità con l'interfaccia esistente
    return {
      subtotal: unified.finalTotal,
      originalSubtotal: unified.originalSubtotal,
      discount: unified.totalDiscountSavings,
      giftSavings: unified.giftSavings,
      total: unified.finalTotal,
      totalSavings: unified.totalSavings,
      // Aggiungi dettagli per uso avanzato
      detailed: unified
    };
  };

  // Ottieni tutti gli item del carrello con info sui regali
  const getItemsWithRuleInfo = () =>
    cart.cart.items.map((item) => ({
      ...item,
      isGift: isItemGift(item.id),
      giftSettings: getItemGiftSettings(item.id),
      appliedRules: getAppliedRules(item.id),
    }));

  // Motivo per cui un item non è disponibile
  const getUnavailableReason = (itemId: string) => {
    if (isItemAvailable(itemId)) return null;

    const itemState = rulesEvaluation.itemStates[itemId];
    if (!itemState || !itemState.appliedRules) return "Elemento non disponibile";

    const disableRule = itemState.appliedRules.find(
      (ruleName: string) => {
        const rule = selectionRules.find((r: any) => r.name === ruleName);
        return rule && rule.action === "disable";
      }
    );

    if (disableRule) {
      const rule = selectionRules.find((r: any) => r.name === disableRule);
      return rule?.description || "Elemento non disponibile";
    }

    return "Elemento non disponibile";
  };

  // Lista di tutti gli item con info su disponibilità (per Carousel, etc.)
  const getAllItemsWithAvailability = () =>
    allItems.map((item: Item) => ({
      ...item,
      isAvailable: isItemAvailable(item.id),
      isGift: isItemGift(item.id),
      giftSettings: getItemGiftSettings(item.id),
      appliedRules: getAppliedRules(item.id),
    }));

  // Debug helper (solo in dev)
  const getDebugInfo = () => ({
    rulesEvaluation,
    allItems,
    selectionRules,
    cartItems: cart.cart.items,
  });

  // Aiuto per capire regole required_items
  const getRequiredItemIds = (targetItemId: string) => {
    try {
      // Trova regole che disabilitano targetItemId
      const disablingRules = selectionRules.filter(
        (r: any) =>
          r.action === "disable" &&
          r.targetItems?.includes(targetItemId) &&
          r.conditions?.type === "required_items",
      );

      for (const rule of disablingRules) {
        if (rule.conditions?.requiredItems) {
          return rule.conditions.requiredItems;
        }
      }
      return [];
    } catch (e) {
      console.error("Error in getRequiredItemIds:", e);
      return [];
    }
  };

  return {
    ...cart,

    // Espone addItem con controllo regole
    addItem: addItemWithRules,

    // API regole
    isItemAvailable,
    isItemGift,
    getItemGiftSettings,
    getUnavailableReason,
    getAppliedRules,
    getPricingWithRules,
    getItemsWithRuleInfo,
    getAllItemsWithAvailability,
    getRequiredItemIds,

    // Dati/evaluations
    rulesEvaluation,
    appliedRules: rulesEvaluation.appliedRules,

    // Loading combinato
    rulesLoading: rulesLoading || itemsLoading || discountsLoading,

    // Debug in dev
    ...(process.env.NODE_ENV === "development" && { getDebugInfo }),
  };
}