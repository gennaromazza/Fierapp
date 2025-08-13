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
  const discount = discounts.global;
  if (!discount?.isActive) return originalPrice;

  // Check if discount is expired
  const now = new Date();
  if (discount.endDate && isAfter(now, discount.endDate)) {
    return originalPrice;
  }
  
  // Check if discount hasn't started yet
  if (discount.startDate && isBefore(now, discount.startDate)) {
    return originalPrice;
  }

  // Apply discount
  if (discount.type === "percent") {
    const discountAmount = (originalPrice * discount.value) / 100;
    return Math.max(0, originalPrice - discountAmount);
  } else if (discount.type === "fixed") {
    return Math.max(0, originalPrice - discount.value);
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

export function isDiscountActive(discount: Discount): boolean {
  const now = new Date();
  
  // Check if discount is explicitly marked as inactive
  if (discount.isActive === false) return false;
  
  // Check if discount has started
  if (discount.startDate && now < discount.startDate) return false;
  
  // Check if discount has expired
  if (discount.endDate && now > discount.endDate) return false;
  
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

/**
 * Get discount information for an item
 * Returns which discount is being applied and the savings amount
 */
export function getItemDiscountInfo(
  originalPrice: number,
  itemId: string,
  discounts: Discounts
): {
  hasDiscount: boolean;
  discountType: 'individual' | 'global' | null;
  discountValue: number;
  discountPercentage: number;
  finalPrice: number;
  savings: number;
} {
  const finalPrice = calculateDiscountedPrice(originalPrice, itemId, discounts);
  const savings = originalPrice - finalPrice;
  
  // Check which discount was applied
  const itemDiscount = discounts.perItemOverrides?.[itemId];
  let discountType: 'individual' | 'global' | null = null;
  let discountValue = 0;
  
  if (itemDiscount?.isActive && isDiscountActive(itemDiscount)) {
    discountType = 'individual';
    discountValue = itemDiscount.value;
  } else if (discounts.global?.isActive && isDiscountActive(discounts.global) && savings > 0) {
    discountType = 'global';
    discountValue = discounts.global.value;
  }
  
  const discountPercentage = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  
  return {
    hasDiscount: savings > 0,
    discountType,
    discountValue,
    discountPercentage,
    finalPrice,
    savings
  };
}

/**
 * Calculate comprehensive savings summary for the entire cart
 */
export function calculateCartSavings(
  cartItems: Array<{ id: string; price: number; originalPrice?: number; quantity?: number }>,
  discounts: Discounts | null,
  giftSavings: number = 0
): {
  originalTotal: number;
  finalTotal: number;
  globalDiscountSavings: number;
  individualDiscountSavings: number;
  totalDiscountSavings: number;
  giftSavings: number;
  totalSavings: number;
  savingsDetails: Array<{
    itemId: string;
    originalPrice: number;
    finalPrice: number;
    savings: number;
    discountType: 'individual' | 'global' | null;
  }>;
} {
  let originalTotal = 0;
  let finalTotal = 0;
  let globalDiscountSavings = 0;
  let individualDiscountSavings = 0;
  const savingsDetails: Array<any> = [];
  
  cartItems.forEach(item => {
    const quantity = item.quantity || 1;
    const originalPrice = item.originalPrice || item.price;
    const itemOriginalTotal = originalPrice * quantity;
    
    if (discounts && item.price > 0) { // Skip gift items (price = 0)
      const discountInfo = getItemDiscountInfo(originalPrice, item.id, discounts);
      const itemFinalTotal = discountInfo.finalPrice * quantity;
      
      originalTotal += itemOriginalTotal;
      finalTotal += itemFinalTotal;
      
      if (discountInfo.discountType === 'global') {
        globalDiscountSavings += discountInfo.savings * quantity;
      } else if (discountInfo.discountType === 'individual') {
        individualDiscountSavings += discountInfo.savings * quantity;
      }
      
      savingsDetails.push({
        itemId: item.id,
        originalPrice: originalPrice,
        finalPrice: discountInfo.finalPrice,
        savings: discountInfo.savings * quantity,
        discountType: discountInfo.discountType
      });
    } else {
      originalTotal += itemOriginalTotal;
      finalTotal += item.price * quantity; // May be 0 for gifts
      
      savingsDetails.push({
        itemId: item.id,
        originalPrice: originalPrice,
        finalPrice: item.price,
        savings: 0,
        discountType: null
      });
    }
  });
  
  const totalDiscountSavings = globalDiscountSavings + individualDiscountSavings;
  const totalSavings = totalDiscountSavings + giftSavings;
  
  return {
    originalTotal,
    finalTotal,
    globalDiscountSavings,
    individualDiscountSavings,
    totalDiscountSavings,
    giftSavings,
    totalSavings,
    savingsDetails
  };
}