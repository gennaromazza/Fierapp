import { useCart } from "./useCart";
import { useSelectionRules } from "./useSelectionRules";
import { RulesEngine } from "../lib/rulesEngine";
import { useMemo, useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import type { Item, CartItem } from "../../../shared/schema";
import type {
  RulesEvaluationResult,
  ItemState,
  SelectionRule,
} from "../../../shared/rulesSchema";
import { toast } from "../hooks/use-toast";

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
        return [];
      }
    },
  });

  // Regole
  const { rules, loading: rulesLoading } = useSelectionRules();

  // Valutazione regole
  const rulesEvaluation = useMemo((): RulesEvaluationResult => {
    if (itemsLoading || rulesLoading || !allItems.length) {
      const itemStates: Record<string, ItemState> = {};
      allItems.forEach((item) => {
        itemStates[item.id] = {
          itemId: item.id,
          isAvailable: true,
          isGift: false,
          appliedRules: [],
        };
      });
      return { itemStates, appliedRules: [], conflicts: [] };
    }

    // Mappa i cart items ai full items
    const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
      const fullItem = allItems.find((i) => i.id === cartItem.id);
      return (
        fullItem ||
        ({
          ...cartItem,
          active: true,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Item)
      );
    });

    const rulesEngine = new RulesEngine(rules, allItems);
    const evaluation = rulesEngine.evaluate(cartAsItems);

    // Debug gift
    console.log("🎁 Rules Evaluation:", {
      cartItems: cartAsItems.map((i) => i.title),
      appliedRules: evaluation.appliedRules,
      giftItems: Object.entries(evaluation.itemStates)
        .filter(([_, s]) => s.isGift)
        .map(([id, s]) => {
          const item = allItems.find((i) => i.id === id);
          return { id, title: item?.title, state: s };
        }),
    });

    return evaluation;
  }, [cart.cart.items, rules, allItems, itemsLoading, rulesLoading]);

  // Auto-rimozione item non più disponibili
  useEffect(() => {
    if (itemsLoading || rulesLoading) return;

    const toRemove: string[] = [];
    cart.cart.items.forEach((cartItem: CartItem) => {
      const st = rulesEvaluation.itemStates[cartItem.id];
      if (st && !st.isAvailable) {
        toRemove.push(cartItem.id);
        console.log(
          `🚮 Rimuovo automaticamente ${cartItem.title} (non più disponibile)`,
        );
      }
    });

    if (toRemove.length) {
      setTimeout(() => {
        toRemove.forEach((id) => cart.removeItem(id));
      }, 0);
    }
  }, [rulesEvaluation.itemStates]); // dipende solo dallo stato regole

  // Toast per prodotti appena sbloccati
  const previousAvailabilityRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (itemsLoading || rulesLoading || !allItems.length) return;

    const newlyUnlocked: Item[] = [];
    const currentAvailability: Record<string, boolean> = {};

    allItems.forEach((item) => {
      const isAvail = rulesEvaluation.itemStates[item.id]?.isAvailable ?? true;
      const wasAvail = previousAvailabilityRef.current[item.id] ?? true;
      currentAvailability[item.id] = isAvail;
      if (isAvail && !wasAvail) newlyUnlocked.push(item);
    });

    if (newlyUnlocked.length) {
      const names = newlyUnlocked.map((i) => i.title).join(", ");
      toast({
        title: "🔓 Prodotti Sbloccati!",
        description: `Ora puoi selezionare: ${names}`,
        duration: 5000,
      });
      console.log(
        "🔓 Prodotti sbloccati:",
        newlyUnlocked.map((i) => i.title),
      );
    }

    previousAvailabilityRef.current = currentAvailability;
  }, [rulesEvaluation.itemStates, allItems, itemsLoading, rulesLoading]);

  // Helpers regole
  const isItemAvailable = (itemId: string) =>
    rulesEvaluation.itemStates[itemId]?.isAvailable ?? true;

  const isItemGift = (itemId: string) =>
    rulesEvaluation.itemStates[itemId]?.isGift ?? false;

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

  // Pricing con regali + sconto globale (compatibile con PriceBar)
  const getPricingWithRules = () => {
    const base = {
      subtotal: cart.cart.subtotal,
      discount: cart.cart.discount,
      total: cart.cart.total,
    };

    let adjustedSubtotal = 0;
    let giftSavings = 0;

    cart.cart.items.forEach((item: CartItem) => {
      if (isItemGift(item.id)) giftSavings += item.price;
      else adjustedSubtotal += item.price;
    });

    // Sconto globale (cache locale)
    let globalDiscount = 0;
    try {
      const discountsDoc = localStorage.getItem("cachedDiscounts");
      if (discountsDoc) {
        const discounts = JSON.parse(discountsDoc);
        const hasGlobal = discounts?.global?.isActive;
        if (hasGlobal && discounts.global) {
          if (discounts.global.type === "fixed") {
            globalDiscount = discounts.global.value || 0;
          } else if (discounts.global.type === "percent") {
            globalDiscount = Math.round(
              adjustedSubtotal * ((discounts.global.value || 0) / 100),
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        "Error loading global discounts for pricing calculation:",
        e,
      );
    }

    const finalTotal = Math.max(0, adjustedSubtotal - globalDiscount);
    const totalSavings = base.subtotal - finalTotal + giftSavings;

    return {
      subtotal: adjustedSubtotal,
      originalSubtotal: base.subtotal,
      discount: globalDiscount,
      giftSavings,
      total: finalTotal, // mantenuto per retro-compatibilità
      finalTotal, // alias usato dal DynamicChatGuide
      totalSavings,
    };
  };

  const getItemsWithRuleInfo = () =>
    cart.cart.items.map((item: CartItem) => ({
      ...item,
      isGift: isItemGift(item.id),
      giftSettings: getItemGiftSettings(item.id),
      appliedRules: getAppliedRules(item.id),
      finalPrice: isItemGift(item.id) ? 0 : item.price,
    }));

  const getAllItemsWithAvailability = () =>
    allItems.map((item: Item) => ({
      ...item,
      isAvailable: isItemAvailable(item.id),
      isGift: isItemGift(item.id),
      giftSettings: getItemGiftSettings(item.id),
      appliedRules: getAppliedRules(item.id),
    }));

  const getDebugInfo = () => {
    if (itemsLoading || rulesLoading) {
      return {
        loading: true,
        itemsLoading,
        rulesLoading,
        rulesCount: rules.length,
      };
    }

    const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
      const fullItem = allItems.find((i) => i.id === cartItem.id);
      return (
        fullItem ||
        ({
          ...cartItem,
          active: true,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Item)
      );
    });

    const rulesEngine = new RulesEngine(rules, allItems);
    const engineDebug = rulesEngine.getDebugInfo(cartAsItems);

    return {
      ...engineDebug,
      loadedRules: rules.length,
      cartItems: cartAsItems.length,
      selectedItemIds: cartAsItems.map((i) => i.id),
    };
  };

  const getUnavailableReason = (itemId: string): string => {
    if (rulesLoading || itemsLoading) return "Caricamento...";
    try {
      const rulesEngine = new RulesEngine(rules, allItems);
      const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
        const fullItem = allItems.find((i) => i.id === cartItem.id);
        return (
          fullItem ||
          ({
            ...cartItem,
            active: true,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as unknown as Item)
        );
      });

      const applicable = rules.filter(
        (r) => r.active && r.targetItems.includes(itemId),
      );

      for (const rule of applicable) {
        const conditionMet = rulesEngine.evaluateCondition(
          rule.conditions,
          cartAsItems,
          cartAsItems.map((i) => i.id),
        );

        let shouldShowReason = false;

        if (rule.type === "availability") {
          if (rule.action === "disable") {
            if (rule.conditions.type === "mutually_exclusive") {
              shouldShowReason = conditionMet; // conflitto presente
            } else {
              shouldShowReason = !conditionMet; // requisito mancante
            }
          } else if (rule.action === "enable" && conditionMet) {
            shouldShowReason = true;
          }
        } else if (rule.type === "gift_transformation") {
          if (rule.action === "make_gift" && conditionMet) {
            return generateConditionMessage(rule, allItems, false, "gift");
          }
        }

        if (shouldShowReason) {
          return generateConditionMessage(rule, allItems, !conditionMet);
        }
      }

      return "Non disponibile";
    } catch (e) {
      console.error("Error in getUnavailableReason:", e);
      return "Non disponibile";
    }
  };

  const generateConditionMessage = (
    rule: SelectionRule,
    allItems: Item[],
    _isNegated: boolean = false,
    messageType: "unavailable" | "gift" = "unavailable",
  ): string => {
    const prefix = messageType === "gift" ? "Regalo per:" : "Richiede:";

    switch (rule.conditions.type) {
      case "required_items": {
        const req = rule.conditions.requiredItems || [];
        const names = req.map(
          (id) =>
            allItems.find((i) => i.id === id)?.title || "Prodotto sconosciuto",
        );
        return `${prefix} ${names.join(", ")}`;
      }
      case "min_selection_count": {
        const count = rule.conditions.value || 1;
        return messageType === "gift"
          ? `Regalo per ${count}+ selezioni`
          : `Seleziona almeno ${count} prodotti`;
      }
      case "category_count": {
        const count = rule.conditions.value || 1;
        const cats = (rule.conditions.categories || []).join(", ");
        return messageType === "gift"
          ? `Regalo per ${count} da: ${cats}`
          : `Seleziona ${count} da: ${cats}`;
      }
      case "specific_items": {
        const spec = rule.conditions.specificItems || [];
        const names = spec.map(
          (id) =>
            allItems.find((i) => i.id === id)?.title || "Prodotto sconosciuto",
        );
        return `${prefix} ${names.join(" o ")}`;
      }
      case "mutually_exclusive": {
        const ex = rule.conditions.mutuallyExclusiveWith || [];
        const names = ex.map(
          (id) =>
            allItems.find((i) => i.id === id)?.title || "Prodotto sconosciuto",
        );
        return names.length === 1
          ? `Non disponibile con: ${names[0]}`
          : `Non disponibile con: ${names.join(", ")}`;
      }
      default:
        return (
          rule.description ||
          (messageType === "gift" ? "Regalo speciale" : "Non disponibile")
        );
    }
  };

  const getRequiredItemIds = (itemId: string): string[] => {
    if (rulesLoading || itemsLoading) return [];
    try {
      const rulesEngine = new RulesEngine(rules, allItems);
      const cartAsItems = cart.cart.items.map((cartItem: CartItem) => {
        const fullItem = allItems.find((i) => i.id === cartItem.id);
        return (
          fullItem ||
          ({
            ...cartItem,
            active: true,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as unknown as Item)
        );
      });

      const applicable = rules.filter(
        (r) => r.active && r.targetItems.includes(itemId),
      );

      for (const rule of applicable) {
        const conditionMet = rulesEngine.evaluateCondition(
          rule.conditions,
          cartAsItems,
          cartAsItems.map((i) => i.id),
        );

        if (
          rule.type === "availability" &&
          rule.action === "disable" &&
          !conditionMet
        ) {
          if (
            rule.conditions.type === "required_items" &&
            rule.conditions.requiredItems
          ) {
            return rule.conditions.requiredItems.filter(
              (id) => !cartAsItems.some((i) => i.id === id),
            );
          }
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
    rulesLoading: rulesLoading || itemsLoading,

    // Debug in dev
    ...(process.env.NODE_ENV === "development" && { getDebugInfo }),
  };
}
