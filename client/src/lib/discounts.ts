import { Discount, Discounts } from "@shared/schema";
import { isAfter, isBefore } from "date-fns";

export function calculateDiscountedPrice(
  originalPrice: number,
  itemId: string,
  discounts: Discounts
): number {
  let finalPrice = originalPrice;
  
  // Apply item-specific discount first if exists
  const itemDiscount = discounts.perItemOverrides?.[itemId];
  if (itemDiscount && isDiscountActive(itemDiscount)) {
    if (itemDiscount.type === "percent") {
      const discountAmount = (finalPrice * itemDiscount.value) / 100;
      finalPrice = Math.max(0, finalPrice - discountAmount);
    } else if (itemDiscount.type === "fixed") {
      finalPrice = Math.max(0, finalPrice - itemDiscount.value);
    }
  }

  // Then apply global discount if exists and active
  const globalDiscount = discounts.global;
  if (globalDiscount && isDiscountActive(globalDiscount)) {
    if (globalDiscount.type === "percent") {
      const discountAmount = (finalPrice * globalDiscount.value) / 100;
      finalPrice = Math.max(0, finalPrice - discountAmount);
    } else if (globalDiscount.type === "fixed") {
      finalPrice = Math.max(0, finalPrice - globalDiscount.value);
    }
  }

  return finalPrice;
}

export function calculateTotalDiscount(
  items: Array<{ id: string; originalPrice: number; price: number }>,
  discounts: Discounts
): number {
  return items.reduce((total, item) => {
    const originalPrice = item.originalPrice || item.price;
    const discountInfo = calculateSeparateDiscounts(originalPrice, item.id, discounts);
    return total + (originalPrice - discountInfo.finalPrice);
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
  
  // Check if discount value is > 0
  if (discount.value <= 0) return false;
  
  // Check if discount has started
  if (discount.startDate && now < discount.startDate) return false;
  
  // Check if discount has expired
  if (discount.endDate && now > discount.endDate) return false;
  
  return true;
}

// New function to calculate separate discount amounts
export function calculateSeparateDiscounts(
  originalPrice: number,
  itemId: string,
  discounts: Discounts
): { itemDiscount: number; globalDiscount: number; finalPrice: number } {
  let currentPrice = originalPrice;
  let itemDiscount = 0;
  let globalDiscount = 0;
  
  // Apply item-specific discount first if exists
  const itemDiscountConfig = discounts.perItemOverrides?.[itemId];
  if (itemDiscountConfig && isDiscountActive(itemDiscountConfig)) {
    let discountAmount = 0;
    if (itemDiscountConfig.type === "percent") {
      discountAmount = (currentPrice * itemDiscountConfig.value) / 100;
    } else if (itemDiscountConfig.type === "fixed") {
      discountAmount = itemDiscountConfig.value;
    }
    itemDiscount = Math.min(discountAmount, currentPrice);
    currentPrice = Math.max(0, currentPrice - itemDiscount);
  }

  // Then apply global discount if exists and active
  const globalDiscountConfig = discounts.global;
  if (globalDiscountConfig && isDiscountActive(globalDiscountConfig)) {
    let discountAmount = 0;
    if (globalDiscountConfig.type === "percent") {
      discountAmount = (currentPrice * globalDiscountConfig.value) / 100;
    } else if (globalDiscountConfig.type === "fixed") {
      discountAmount = globalDiscountConfig.value;
    }
    globalDiscount = Math.min(discountAmount, currentPrice);
    currentPrice = Math.max(0, currentPrice - globalDiscount);
  }

  return { itemDiscount, globalDiscount, finalPrice: currentPrice };
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