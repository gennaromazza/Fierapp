import type { CartItem } from "@shared/schema";
import { calculateCartSavings, getItemDiscountInfo } from "./discounts";

export interface UnifiedPricingResult {
  subtotal: number;
  originalSubtotal: number;
  globalDiscountSavings: number;
  individualDiscountSavings: number;
  totalDiscountSavings: number;
  giftSavings: number;
  finalTotal: number;
  totalSavings: number;
  itemDetails: Array<{
    id: string;
    title: string;
    originalPrice: number;
    finalPrice: number;
    isGift: boolean;
    discountType: 'global' | 'individual' | null;
    savings: number;
  }>;
}

export interface MarketingMessages {
  mainSavings?: string;
  giftMessage?: string;
  urgencyText?: string;
  valueProposition?: string;
}

/**
 * Sistema unificato per calcolare prezzi, sconti e generare messaggi marketing
 */
export function calculateUnifiedPricing(
  cartItems: CartItem[],
  discounts: any = null,
  giftItemIds: string[] = []
): UnifiedPricingResult {
  let subtotal = 0;
  let originalSubtotal = 0;
  let giftSavings = 0;
  
  const itemDetails = cartItems.map(item => {
    const originalPrice = item.originalPrice || item.price;
    const isGift = giftItemIds.includes(item.id);
    
    // Calcola prezzo scontato tramite sistema sconti
    let finalPrice = originalPrice;
    let discountType: 'global' | 'individual' | null = null;
    let itemSavings = 0;
    
    if (discounts && !isGift) {
      const discountInfo = getItemDiscountInfo(originalPrice, item.id, discounts);
      finalPrice = discountInfo.finalPrice;
      discountType = discountInfo.discountType;
      itemSavings = discountInfo.savings;
    }
    
    // Se è un regalo, il prezzo finale è 0 e risparmi tutto il prezzo originale
    if (isGift) {
      giftSavings += originalPrice;
      finalPrice = 0;
      itemSavings = originalPrice;
    }
    
    subtotal += finalPrice;
    originalSubtotal += originalPrice;
    
    return {
      id: item.id,
      title: item.title,
      originalPrice,
      finalPrice,
      isGift,
      discountType: isGift ? null : discountType,
      savings: itemSavings
    };
  });
  
  // Calcola sconti separati
  const globalDiscountSavings = itemDetails
    .filter(item => item.discountType === 'global')
    .reduce((sum, item) => sum + item.savings, 0);
    
  const individualDiscountSavings = itemDetails
    .filter(item => item.discountType === 'individual')
    .reduce((sum, item) => sum + item.savings, 0);
  
  const totalDiscountSavings = globalDiscountSavings + individualDiscountSavings;
  const totalSavings = totalDiscountSavings + giftSavings;
  
  return {
    subtotal,
    originalSubtotal,
    globalDiscountSavings,
    individualDiscountSavings,
    totalDiscountSavings,
    giftSavings,
    finalTotal: subtotal,
    totalSavings,
    itemDetails
  };
}

/**
 * Genera messaggi marketing persuasivi basati sui risparmi
 */
export function generateMarketingMessages(pricing: UnifiedPricingResult): MarketingMessages {
  const messages: MarketingMessages = {};
  
  if (pricing.totalSavings > 0) {
    const savingsPercentage = Math.round((pricing.totalSavings / pricing.originalSubtotal) * 100);
    
    // Messaggio principale sui risparmi
    if (savingsPercentage >= 50) {
      messages.mainSavings = `🔥 INCREDIBILE! Stai risparmiando oltre il ${savingsPercentage}% - ben €${pricing.totalSavings.toLocaleString('it-IT')}!`;
    } else if (savingsPercentage >= 30) {
      messages.mainSavings = `💰 SUPER RISPARMIO! ${savingsPercentage}% di sconto equivale a €${pricing.totalSavings.toLocaleString('it-IT')} in meno!`;
    } else if (savingsPercentage >= 15) {
      messages.mainSavings = `✨ OTTIMO AFFARE! Risparmi €${pricing.totalSavings.toLocaleString('it-IT')} (${savingsPercentage}% di sconto)`;
    } else {
      messages.mainSavings = `💡 Conveniente! Risparmi €${pricing.totalSavings.toLocaleString('it-IT')}`;
    }
    
    // Messaggio sui regali
    if (pricing.giftSavings > 0) {
      const giftCount = pricing.itemDetails.filter(item => item.isGift).length;
      messages.giftMessage = `🎁 Inclusi ${giftCount} servizi GRATUITI del valore di €${pricing.giftSavings.toLocaleString('it-IT')}!`;
    }
    
    // Testo di urgenza
    if (savingsPercentage >= 40) {
      messages.urgencyText = "⚡ Offerta limitata! Non perdere questo vantaggio esclusivo!";
    } else if (savingsPercentage >= 20) {
      messages.urgencyText = "⏰ Approfitta subito di questo prezzo speciale!";
    }
    
    // Value proposition
    if (pricing.originalSubtotal >= 5000) {
      messages.valueProposition = `💎 Pacchetto Premium: €${pricing.originalSubtotal.toLocaleString('it-IT')} di servizi al prezzo di €${pricing.finalTotal.toLocaleString('it-IT')}`;
    } else if (pricing.originalSubtotal >= 2000) {
      messages.valueProposition = `🌟 Pacchetto Completo: qualità professionale con ${savingsPercentage}% di risparmio`;
    }
  }
  
  return messages;
}

/**
 * Formatta il riepilogo prezzi per PDF/WhatsApp
 */
export function formatPricingSummary(pricing: UnifiedPricingResult): string {
  const lines: string[] = [];
  
  lines.push(`Subtotale: €${pricing.originalSubtotal.toLocaleString('it-IT')}`);
  
  if (pricing.globalDiscountSavings > 0) {
    lines.push(`Sconto globale: -€${pricing.globalDiscountSavings.toLocaleString('it-IT')}`);
  }
  
  if (pricing.individualDiscountSavings > 0) {
    lines.push(`Sconti individuali: -€${pricing.individualDiscountSavings.toLocaleString('it-IT')}`);
  }
  
  if (pricing.giftSavings > 0) {
    lines.push(`Servizi gratuiti: -€${pricing.giftSavings.toLocaleString('it-IT')}`);
  }
  
  lines.push(`TOTALE: €${pricing.finalTotal.toLocaleString('it-IT')}`);
  
  if (pricing.totalSavings > 0) {
    lines.push(`\nTotale risparmiato: €${pricing.totalSavings.toLocaleString('it-IT')}!`);
  }
  
  return lines.join('\n');
}