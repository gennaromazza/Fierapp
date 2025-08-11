import { Discount, Discounts } from "@shared/schema";
import { isAfter, isBefore } from "date-fns";

export function calculateDiscountedPrice(
  originalPrice: number,
  itemId: string,
  discounts: Discounts
): number {
  // Check for item-specific discount first
  const itemDiscount = discounts.perItemOverrides?.[itemId];
  const discount = itemDiscount || discounts.global;

  if (!discount) return originalPrice;

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