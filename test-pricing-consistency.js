#!/usr/bin/env node

/**
 * Test rapido per verificare consistenza pricing in tempo reale
 * Simula una richiesta API per testare tutti i componenti
 */

console.log('🧪 TEST CONSISTENZA PRICING - SIMULAZIONE COMPLETA');
console.log('====================================================\n');

// Simula il flusso completo
function simulateFullPricingFlow() {
  console.log('📝 SIMULAZIONE FLUSSO COMPLETO:');
  console.log('================================');
  
  // Step 1: Chat adds items to cart
  console.log('1. 🛒 Chat aggiunge servizi al carrello:');
  const cartItems = [
    { title: 'Servizio Fotografico', price: 600, originalPrice: 600 },
    { title: 'Videomaker', price: 850, originalPrice: 850 },
    { title: 'Album Sposi Big 30x40', price: 800, originalPrice: 800 },
    { title: 'VideoProiezione', price: 200, originalPrice: 200 },
    { title: 'Riprese Drone', price: 300, originalPrice: 300 },
    { title: 'Album Genitori', price: 300, originalPrice: 300 },
    // Gift item triggered by rules
    { title: 'Foto per Invitati', price: 0, originalPrice: 450, isGift: true }
  ];
  
  cartItems.forEach(item => {
    const priceDisplay = item.isGift ? '🎁 GRATIS' : `€${item.price}`;
    console.log(`   • ${item.title}: ${priceDisplay}`);
  });
  
  // Step 2: Calculate pricing with rules
  console.log('\n2. 🧮 Sistema calcola pricing con regole:');
  const paidItems = cartItems.filter(item => !item.isGift);
  const giftItems = cartItems.filter(item => item.isGift);
  
  const subtotal = paidItems.reduce((sum, item) => sum + item.price, 0);
  const globalDiscountPercent = 0.10;
  const globalDiscountAmount = Math.round(subtotal * globalDiscountPercent);
  const giftSavings = giftItems.reduce((sum, item) => sum + item.originalPrice, 0);
  const finalTotal = subtotal - globalDiscountAmount;
  const totalSavings = globalDiscountAmount + giftSavings;
  
  const calculatedPricing = {
    subtotal,
    globalDiscountAmount,
    giftSavings,
    finalTotal,
    totalSavings,
    detailed: {
      subtotal,
      individualDiscountSavings: 0,
      globalDiscountSavings: globalDiscountAmount,
      finalTotal
    }
  };
  
  console.log(`   Subtotal servizi a pagamento: €${subtotal.toLocaleString('it-IT')}`);
  console.log(`   Sconto globale (10%): -€${globalDiscountAmount.toLocaleString('it-IT')}`);
  console.log(`   Servizi in omaggio: -€${giftSavings.toLocaleString('it-IT')}`);
  console.log(`   Totale finale: €${finalTotal.toLocaleString('it-IT')}`);
  console.log(`   Totale risparmiato: €${totalSavings.toLocaleString('it-IT')}`);
  
  // Step 3: Chat displays summary
  console.log('\n3. 💬 Chat mostra riepilogo finale:');
  console.log(`   "💰 Totale finale: €${finalTotal.toLocaleString('it-IT')}"`);
  console.log(`   "✨ RISPARMI TOTALI: €${totalSavings.toLocaleString('it-IT')} 💫"`);
  console.log(`   "🎁 Prodotti GRATUITI: ${giftItems.map(i => i.title).join(', ')}"`);
  
  // Step 4: Form saves lead
  console.log('\n4. 💾 Form salva lead con struttura:');
  const leadPricingStructure = {
    subtotal: calculatedPricing.subtotal,
    total: calculatedPricing.finalTotal,
    giftSavings: calculatedPricing.giftSavings,
    totalSavings: calculatedPricing.totalSavings,
    detailed: {
      individualDiscountSavings: 0,
      globalDiscountSavings: calculatedPricing.globalDiscountAmount,
      subtotal: calculatedPricing.subtotal,
      finalTotal: calculatedPricing.finalTotal
    }
  };
  
  console.log('   Struttura salvata nel database:');
  Object.entries(leadPricingStructure).forEach(([key, value]) => {
    if (typeof value === 'object') {
      console.log(`   ${key}:`);
      Object.entries(value).forEach(([subKey, subValue]) => {
        console.log(`     ${subKey}: ${typeof subValue === 'number' ? '€' + subValue.toLocaleString('it-IT') : subValue}`);
      });
    } else {
      console.log(`   ${key}: €${value.toLocaleString('it-IT')}`);
    }
  });
  
  // Step 5: Verify all components use same data
  console.log('\n5. ✅ Verifica che tutti i componenti usino gli stessi dati:');
  
  // Admin panel display
  console.log('\n   🔧 ADMIN PANEL dovrebbe mostrare:');
  console.log(`   - Subtotale servizi/prodotti: €${leadPricingStructure.subtotal.toLocaleString('it-IT')}`);
  console.log(`   - Sconto globale (-10%): -€${leadPricingStructure.detailed.globalDiscountSavings.toLocaleString('it-IT')}`);
  console.log(`   - Servizi in omaggio: -€${leadPricingStructure.giftSavings.toLocaleString('it-IT')}`);
  console.log(`   - TOTALE: €${leadPricingStructure.total.toLocaleString('it-IT')}`);
  console.log(`   - Totale risparmiato: €${leadPricingStructure.totalSavings.toLocaleString('it-IT')}`);
  
  // WhatsApp message
  console.log('\n   📱 WHATSAPP MESSAGE dovrebbe mostrare:');
  console.log(`   - Subtotale servizi/prodotti: €${leadPricingStructure.subtotal.toLocaleString('it-IT')}`);
  console.log(`   - Sconto globale (-10%): -€${leadPricingStructure.detailed.globalDiscountSavings.toLocaleString('it-IT')}`);
  console.log(`   - Servizi in omaggio: -€${leadPricingStructure.giftSavings.toLocaleString('it-IT')}`);
  console.log(`   - TOTALE: €${leadPricingStructure.total.toLocaleString('it-IT')}`);
  console.log(`   - Totale risparmiato: €${leadPricingStructure.totalSavings.toLocaleString('it-IT')}`);
  
  // PDF generation
  console.log('\n   📄 PDF dovrebbe mostrare:');
  console.log(`   - Subtotale servizi/prodotti: €${leadPricingStructure.subtotal.toLocaleString('it-IT')}`);
  console.log(`   - Sconto globale (-10%): -€${leadPricingStructure.detailed.globalDiscountSavings.toLocaleString('it-IT')}`);
  console.log(`   - Servizi in omaggio: -€${leadPricingStructure.giftSavings.toLocaleString('it-IT')}`);
  console.log(`   - TOTALE: €${leadPricingStructure.total.toLocaleString('it-IT')}`);
  console.log('   - "Foto per Invitati" con badge GRATIS e prezzo originale barrato');
  
  return calculatedPricing;
}

// Esegui simulazione
const results = simulateFullPricingFlow();

console.log('\n');
console.log('🎯 VALORI TARGET DA VERIFICARE OVUNQUE:');
console.log('========================================');
console.log(`✓ Subtotal: €${results.subtotal.toLocaleString('it-IT')} (solo servizi a pagamento)`);
console.log(`✓ Sconto globale: -€${results.globalDiscountAmount.toLocaleString('it-IT')} (10% del subtotal)`);
console.log(`✓ Servizi omaggio: -€${results.giftSavings.toLocaleString('it-IT')} (valore regali)`);
console.log(`✓ Totale finale: €${results.finalTotal.toLocaleString('it-IT')} (da pagare)`);
console.log(`✓ Totale risparmiato: €${results.totalSavings.toLocaleString('it-IT')} (sconti + regali)`);

console.log('\n🚨 SE VEDI VALORI DIVERSI, C\'È UN BUG!');
console.log('======================================');
console.log('❌ Se vedi €3.150 = subtotal include regali (SBAGLIATO)');
console.log('❌ Se vedi -€350 = sconto su 3500 invece che su 3150 (SBAGLIATO)');
console.log('❌ Se vedi €3.150 come totale = nessuno sconto applicato (SBAGLIATO)');

console.log('\n🔧 COMANDO: node test-pricing-consistency.js');