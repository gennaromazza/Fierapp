import { Discount, Discounts } from "@shared/schema";
import { isAfter, isBefore } from "date-fns";

export function calculateDiscountedPrice(
  originalPrice: number,
  itemId: string,
  discounts: Discounts
): number {
  // Check for item-specific discount first (takes priority over global)
  const itemDiscount = discounts.perItemOverrides?.[itemId];
  if (itemDiscount?.isActive) {
    const now = new Date();
    if (itemDiscount.endDate && isAfter(now, itemDiscount.endDate)) {
      // Item discount expired, fallback to global
    } else if (itemDiscount.startDate && isBefore(now, itemDiscount.startDate)) {
      // Item discount not started yet, fallback to global
    } else {
      // Apply item-specific discount
      if (itemDiscount.type === "percent") {
        const discountAmount = (originalPrice * itemDiscount.value) / 100;
        return Math.max(0, originalPrice - discountAmount);
      } else if (itemDiscount.type === "fixed") {
        return Math.max(0, originalPrice - itemDiscount.value);
      }
    }
  }

  // Apply global discount if no valid item-specific discount
  const globalDiscount = discounts.global;
  if (!globalDiscount?.isActive) return originalPrice;

  // Check if discount is expired
  const now = new Date();
  if (globalDiscount.endDate && isAfter(now, globalDiscount.endDate)) {
    return originalPrice;
  }
  
  // Check if discount hasn't started yet
  if (globalDiscount.startDate && isBefore(now, globalDiscount.startDate)) {
    return originalPrice;
  }

  // Apply global discount
  if (globalDiscount.type === "percent") {
    const discountAmount = (originalPrice * globalDiscount.value) / 100;
    return Math.max(0, originalPrice - discountAmount);
  } else if (globalDiscount.type === "fixed") {
    return Math.max(0, originalPrice - globalDiscount.value);
  }

  return originalPrice;
}

export function calculateTotalDiscount(
  items: Array<{ id: string; originalPrice: number; price: number }>,
  discounts: Discounts
): number {
  return items.reduce((total, item) => {
    const originalPrice = item.originalPrice || item.price;
    const discountedPrice = calculateDiscountedPrice(originalPrice, item.id, discounts);
    return total + (originalPrice - discountedPrice);
  }, 0);
}

export function getDiscountPercentage(
  originalPrice: number,
  discountedPrice: number
): number {
  if (originalPrice <= 0) return 0;
  const savings = originalPrice - discountedPrice;
  return Math.round((savings / originalPrice) * 100);
}

/**
 * Ottiene informazioni dettagliate sugli sconti applicati a un item
 */
export function getItemDiscountInfo(originalPrice: number, itemId: string, discounts: Discounts | null) {
  if (!discounts) {
    return {
      finalPrice: originalPrice,
      savings: 0,
      discountType: null,
      discountValue: 0
    };
  }

  // Check item-specific discount first
  const itemDiscount = discounts.perItemOverrides?.[itemId];
  if (itemDiscount && isDiscountActive(itemDiscount)) {
    let finalPrice = originalPrice;
    
    if (itemDiscount.type === "percent") {
      const discountAmount = (originalPrice * itemDiscount.value) / 100;
      finalPrice = Math.max(0, originalPrice - discountAmount);
    } else if (itemDiscount.type === "fixed") {
      finalPrice = Math.max(0, originalPrice - itemDiscount.value);
    }
    
    return {
      finalPrice,
      savings: originalPrice - finalPrice,
      discountType: 'individual' as const,
      discountValue: itemDiscount.value
    };
  }

  // Apply global discount
  const globalDiscount = discounts.global;
  if (globalDiscount && isDiscountActive(globalDiscount)) {
    let finalPrice = originalPrice;
    
    if (globalDiscount.type === "percent") {
      const discountAmount = (originalPrice * globalDiscount.value) / 100;
      finalPrice = Math.max(0, originalPrice - discountAmount);
    } else if (globalDiscount.type === "fixed") {
      finalPrice = Math.max(0, originalPrice - globalDiscount.value);
    }
    
    return {
      finalPrice,
      savings: originalPrice - finalPrice,
      discountType: 'global' as const,
      discountValue: globalDiscount.value
    };
  }

  return {
    finalPrice: originalPrice,
    savings: 0,
    discountType: null,
    discountValue: 0
  };
}

/**
 * Calcola i risparmi totali del carrello con dettagli separati
 */
export function calculateCartSavings(items: Array<{ id: string; originalPrice: number; price: number }>, discounts: Discounts | null) {
  if (!discounts) {
    return {
      globalSavings: 0,
      individualSavings: 0,
      totalSavings: 0
    };
  }

  let globalSavings = 0;
  let individualSavings = 0;

  items.forEach(item => {
    const originalPrice = item.originalPrice || item.price;
    const discountInfo = getItemDiscountInfo(originalPrice, item.id, discounts);
    
    if (discountInfo.discountType === 'global') {
      globalSavings += discountInfo.savings;
    } else if (discountInfo.discountType === 'individual') {
      individualSavings += discountInfo.savings;
    }
  });

  return {
    globalSavings,
    individualSavings,
    totalSavings: globalSavings + individualSavings
  };
}

export function isDiscountActive(discount: Discount): boolean {
  const now = new Date();
  
  if (!discount.isActive) return false;
  
  // Check if discount hasn't started yet
  if (discount.startDate && isBefore(now, discount.startDate)) {
    return false;
  }
  
  // Check if discount is expired
  if (discount.endDate && isAfter(now, discount.endDate)) {
    return false;
  }
  
  return true;
}

export function isDiscountExpired(discount: Discount): boolean {
  if (!discount.endDate) return false;
  return new Date() > discount.endDate;
}

export function getDiscountStatus(discount: Discount): "active" | "expired" | "scheduled" | "inactive" {
  if (!discount.value || discount.value <= 0) return "inactive";
  if (discount.isActive === false) return "inactive";
  
  const now = new Date();
  
  if (discount.endDate && now > discount.endDate) return "expired";
  if (discount.startDate && now < discount.startDate) return "scheduled";
  
  return "active";
}

export function calculateDiscount(originalPrice: number, discount: Discount): number {
  if (!isDiscountActive(discount)) return 0;
  
  if (discount.type === "percent") {
    return Math.round((originalPrice * discount.value) / 100);
  } else {
    return Math.min(discount.value, originalPrice);
  }
}

export function formatDiscountText(discount: Discount): string {
  if (discount.type === "percent") {
    return `-${discount.value}%`;
  } else {
    return `-€${discount.value.toLocaleString('it-IT')}`;
  }
}

export function getDiscountBadgeColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "expired":
      return "bg-red-100 text-red-800";
    case "scheduled":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getDiscountBadgeText(status: string): string {
  switch (status) {
    case "active":
      return "Attivo";
    case "expired":
      return "Scaduto";
    case "scheduled":
      return "Programmato";
    default:
      return "Inattivo";
  }
}

