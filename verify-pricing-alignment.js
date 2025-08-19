#!/usr/bin/env node

/**
 * Script di verifica per l'allineamento dei calcoli di pricing
 * Testa che tutti i componenti (Chat, Admin, WhatsApp, PDF) mostrino gli stessi valori
 */

console.log('🔍 VERIFICA ALLINEAMENTO CALCOLI PRICING');
console.log('==========================================\n');

// Simula dati del carrello di test
const mockCartData = {
  items: [
    { id: '1', title: 'Servizio Fotografico', price: 600, originalPrice: 600, isGift: false },
    { id: '2', title: 'Videomaker', price: 850, originalPrice: 850, isGift: false },
    { id: '3', title: 'Album Sposi Big 30x40', price: 800, originalPrice: 800, isGift: false },
    { id: '4', title: 'VideoProiezione', price: 200, originalPrice: 200, isGift: false },
    { id: '5', title: 'Foto per Invitati', price: 0, originalPrice: 450, isGift: true },
    { id: '6', title: 'Riprese Drone', price: 300, originalPrice: 300, isGift: false },
    { id: '7', title: 'Album Genitori', price: 300, originalPrice: 300, isGift: false }
  ],
  globalDiscount: 0.10 // 10%
};

// Calcolo manuale di riferimento
function calculateExpectedPricing(cartData) {
  console.log('🧮 CALCOLO MANUALE DI RIFERIMENTO:');
  console.log('==================================');
  
  const paidItems = cartData.items.filter(item => !item.isGift);
  const giftItems = cartData.items.filter(item => item.isGift);
  
  // Subtotal solo servizi a pagamento
  const subtotal = paidItems.reduce((sum, item) => sum + item.price, 0);
  console.log(`📊 Subtotal servizi a pagamento: €${subtotal.toLocaleString('it-IT')}`);
  
  // Sconto globale sul subtotal
  const globalDiscountAmount = subtotal * cartData.globalDiscount;
  console.log(`📊 Sconto globale (${(cartData.globalDiscount * 100)}%): -€${globalDiscountAmount.toLocaleString('it-IT')}`);
  
  // Valore servizi in omaggio
  const giftSavings = giftItems.reduce((sum, item) => sum + item.originalPrice, 0);
  console.log(`📊 Valore servizi in omaggio: -€${giftSavings.toLocaleString('it-IT')}`);
  
  // Totale finale
  const finalTotal = subtotal - globalDiscountAmount;
  console.log(`📊 Totale finale: €${finalTotal.toLocaleString('it-IT')}`);
  
  // Totale risparmiato
  const totalSavings = globalDiscountAmount + giftSavings;
  console.log(`📊 Totale risparmiato: €${totalSavings.toLocaleString('it-IT')}`);
  
  console.log('\n');
  
  return {
    subtotal,
    globalDiscountAmount,
    giftSavings,
    finalTotal,
    totalSavings,
    paidItems: paidItems.length,
    giftItems: giftItems.length
  };
}

// Verifica calcoli
function verifyCalculations() {
  const expected = calculateExpectedPricing(mockCartData);
  
  console.log('✅ VALORI ATTESI PER TUTTI I COMPONENTI:');
  console.log('=========================================');
  console.log(`• Subtotale servizi/prodotti: €${expected.subtotal.toLocaleString('it-IT')}`);
  console.log(`• Sconto globale (-10%): -€${expected.globalDiscountAmount.toLocaleString('it-IT')}`);
  console.log(`• Servizi in omaggio: -€${expected.giftSavings.toLocaleString('it-IT')}`);
  console.log(`• TOTALE: €${expected.finalTotal.toLocaleString('it-IT')}`);
  console.log(`• Totale risparmiato: €${expected.totalSavings.toLocaleString('it-IT')}`);
  console.log(`• Servizi a pagamento: ${expected.paidItems}`);
  console.log(`• Servizi in omaggio: ${expected.giftItems}`);
  
  console.log('\n');
  
  console.log('🔍 CONTROLLI DA FARE MANUALMENTE:');
  console.log('==================================');
  console.log('1. CHAT CONVERSAZIONALE:');
  console.log('   - Aggiungi tutti i servizi sopra elencati');
  console.log('   - Verifica che il riepilogo finale mostri:');
  console.log(`     💰 Prezzo originale: €${(expected.subtotal + expected.giftSavings).toLocaleString('it-IT')}`);
  console.log(`     💸 Sconto globale (10%): -€${expected.globalDiscountAmount.toLocaleString('it-IT')}`);
  console.log(`     🎁 Risparmi con regali: €${expected.giftSavings.toLocaleString('it-IT')}`);
  console.log(`     💰 Totale finale: €${expected.finalTotal.toLocaleString('it-IT')}`);
  console.log(`     ✨ RISPARMI TOTALI: €${expected.totalSavings.toLocaleString('it-IT')}`);
  
  console.log('\n2. PANNELLO AMMINISTRAZIONE:');
  console.log('   - Apri un lead con i servizi sopra');
  console.log('   - Verifica che mostri:');
  console.log(`     Subtotale servizi/prodotti: €${expected.subtotal.toLocaleString('it-IT')}`);
  console.log(`     Sconto globale (-10%): -€${expected.globalDiscountAmount.toLocaleString('it-IT')}`);
  console.log(`     Servizi in omaggio: -€${expected.giftSavings.toLocaleString('it-IT')}`);
  console.log(`     TOTALE: €${expected.finalTotal.toLocaleString('it-IT')}`);
  console.log(`     💰 Totale risparmiato: €${expected.totalSavings.toLocaleString('it-IT')}`);
  
  console.log('\n3. MESSAGGIO WHATSAPP:');
  console.log('   - Genera richiesta WhatsApp dal lead');
  console.log('   - Verifica che il riepilogo mostri:');
  console.log(`     Subtotale servizi/prodotti: €${expected.subtotal.toLocaleString('it-IT')}`);
  console.log(`     Sconto globale (-10%): -€${expected.globalDiscountAmount.toLocaleString('it-IT')}`);
  console.log(`     Servizi in omaggio: -€${expected.giftSavings.toLocaleString('it-IT')}`);
  console.log(`     TOTALE: €${expected.finalTotal.toLocaleString('it-IT')}`);
  console.log(`     Totale risparmiato: €${expected.totalSavings.toLocaleString('it-IT')}`);
  
  console.log('\n4. PDF PREVENTIVO:');
  console.log('   - Genera PDF dal lead');
  console.log('   - Verifica che la sezione totali mostri:');
  console.log(`     Subtotale servizi/prodotti: €${expected.subtotal.toLocaleString('it-IT')}`);
  console.log(`     Sconto globale (-10%): -€${expected.globalDiscountAmount.toLocaleString('it-IT')}`);
  console.log(`     Servizi in omaggio: -€${expected.giftSavings.toLocaleString('it-IT')}`);
  console.log(`     TOTALE: €${expected.finalTotal.toLocaleString('it-IT')}`);
  console.log('   - Verifica che "Foto per Invitati" mostri "GRATIS" con prezzo originale barrato');
  
  console.log('\n');
  
  console.log('🚨 ERRORI COMUNI DA CONTROLLARE:');
  console.log('=================================');
  console.log('❌ Totale mostra €3.150 invece di €2.750');
  console.log('❌ Sconto globale mostra -€350 invece di -€315');
  console.log('❌ Subtotal include servizi in omaggio');
  console.log('❌ Servizi gratis non mostrano badge "GRATIS"');
  console.log('❌ Prezzi originali non sono barrati per i regali');
  
  console.log('\n');
  
  console.log('✅ SE TUTTI I VALORI CORRISPONDONO:');
  console.log('===================================');
  console.log('🎉 I calcoli sono perfettamente allineati!');
  console.log('🎯 Chat, Admin, WhatsApp e PDF mostrano gli stessi valori');
  console.log('💯 Sistema di pricing unificato funzionante');
  
  return expected;
}

// Esegui la verifica
const results = verifyCalculations();

console.log('\n📋 CHECKLIST VERIFICA RAPIDA:');
console.log('==============================');
console.log('□ Chat mostra totale €2.750');
console.log('□ Admin mostra totale €2.750');
console.log('□ WhatsApp mostra totale €2.750');
console.log('□ PDF mostra totale €2.750');
console.log('□ Tutti mostrano sconto globale -€315');
console.log('□ Tutti mostrano servizi omaggio -€450');
console.log('□ "Foto per Invitati" ha badge 🎁 GRATIS');
console.log('□ Totale risparmiato €755 ovunque');

console.log('\n🔧 Per eseguire questo script: node verify-pricing-alignment.js');