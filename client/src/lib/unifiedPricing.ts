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
    const originalPrice = typeof item.originalPrice === 'number'
      ? item.originalPrice
      : item.price;
    const isGift = giftItemIds.includes(item.id);
    
    let discountedPrice = originalPrice;
    let discountType: 'global' | 'individual' | null = null;
    let itemSavings = 0;
    let individualSavings = 0;
    let globalSavings = 0;
    
    // Calcola il prezzo scontato solo se non è un regalo
    if (!isGift && discounts) {
      const discountInfo = getItemDiscountInfo(originalPrice, item.id, discounts);
      discountedPrice = discountInfo.finalPrice;
      discountType = discountInfo.discountType;
      itemSavings = discountInfo.savings;
      individualSavings = discountInfo.individualSavings || 0;
      globalSavings = discountInfo.globalSavings || 0;
    }
    
    // Forza prezzo 0 per i regali
    const finalPrice = isGift ? 0 : discountedPrice;
    
    // Se è un regalo, aggiungi il risparmio
    if (isGift) {
      giftSavings += originalPrice;
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
      savings: itemSavings,
      individualSavings,
      globalSavings
    };
  });
  
  // Calcola sconti separati (esclusi i regali)
  const globalDiscountSavings = itemDetails
    .filter(item => !item.isGift)
    .reduce((sum, item) => sum + (item.globalSavings || 0), 0);
    
  const individualDiscountSavings = itemDetails
    .filter(item => !item.isGift)
    .reduce((sum, item) => sum + (item.individualSavings || 0), 0);
  
  const totalDiscountSavings = globalDiscountSavings + individualDiscountSavings;
  const totalSavings = totalDiscountSavings + giftSavings;
  
  // CRITICAL FIX: finalTotal deve essere subtotal MENO gli sconti (non giftSavings perché già inclusi in subtotal=0)
  const finalTotal = subtotal - totalDiscountSavings;
  
  return {
    subtotal,
    originalSubtotal,
    globalDiscountSavings,
    individualDiscountSavings,
    totalDiscountSavings,
    giftSavings,
    finalTotal,
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
  
  // USA SUBTOTAL (solo servizi a pagamento) invece di originalSubtotal
  lines.push(`Subtotale servizi/prodotti: €${pricing.subtotal.toLocaleString('it-IT')}`);
  
  if (pricing.globalDiscountSavings > 0) {
    lines.push(`Sconto globale (-10%): -€${pricing.globalDiscountSavings.toLocaleString('it-IT')}`);
  }
  
  if (pricing.individualDiscountSavings > 0) {
    lines.push(`Sconti per prodotto/servizio: -€${pricing.individualDiscountSavings.toLocaleString('it-IT')}`);
  }
  
  if (pricing.giftSavings > 0) {
    lines.push(`Servizi in omaggio: -€${pricing.giftSavings.toLocaleString('it-IT')}`);
  }
  
  lines.push(`TOTALE: €${pricing.finalTotal.toLocaleString('it-IT')}`);
  
  if (pricing.totalSavings > 0) {
    lines.push(`  Totale risparmiato: €${pricing.totalSavings.toLocaleString('it-IT')}!`);
  }
  
  return lines.join('\n');
}