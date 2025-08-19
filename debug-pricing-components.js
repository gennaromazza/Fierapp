#!/usr/bin/env node

/**
 * Script di debug per analizzare i componenti di pricing
 * Aiuta a identificare discrepanze tra i diversi sistemi
 */

console.log('🔧 DEBUG COMPONENTI PRICING SYSTEM');
console.log('===================================\n');

// Simula la struttura dati che dovrebbe essere uniforme ovunque
const unifiedPricingStructure = {
  // Dati base per calcoli
  originalSubtotal: 3600,  // Somma di TUTTI i servizi (compreso quello gratis)
  subtotal: 3150,          // Solo servizi a pagamento
  finalTotal: 2750,        // Totale da pagare (subtotal - sconto globale)
  
  // Breakdown sconti
  individualDiscountSavings: 0,    // Sconti su singoli prodotti
  globalDiscountSavings: 315,      // 10% di subtotal (3150)
  giftSavings: 450,               // Valore servizi in omaggio
  
  // Totali calcolati
  totalDiscountSavings: 315,       // Solo sconti monetari (globale + individuali)
  totalSavings: 765,              // Tutti i risparmi (sconti + regali)
  
  // Dettagli per verifiche
  paidItemsCount: 6,
  giftItemsCount: 1,
  hasGifts: true,
  hasGlobalDiscount: true,
  hasIndividualDiscounts: false
};

function analyzeComponents() {
  console.log('📊 STRUTTURA PRICING UNIFICATA:');
  console.log('================================');
  
  Object.entries(unifiedPricingStructure).forEach(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    if (typeof value === 'number') {
      console.log(`${label.padEnd(25)}: €${value.toLocaleString('it-IT')}`);
    } else {
      console.log(`${label.padEnd(25)}: ${value}`);
    }
  });
  
  console.log('\n');
}

function validateCalculations() {
  console.log('🧮 VALIDAZIONE CALCOLI:');
  console.log('========================');
  
  const p = unifiedPricingStructure;
  
  // Test 1: Subtotal calculation
  const expectedSubtotal = p.originalSubtotal - p.giftSavings;
  const subtotalValid = p.subtotal === expectedSubtotal;
  console.log(`✓ Subtotal calculation: ${subtotalValid ? '✅' : '❌'}`);
  console.log(`  Expected: €${expectedSubtotal.toLocaleString('it-IT')} | Actual: €${p.subtotal.toLocaleString('it-IT')}`);
  
  // Test 2: Global discount calculation
  const expectedGlobalDiscount = Math.round(p.subtotal * 0.10);
  const globalDiscountValid = p.globalDiscountSavings === expectedGlobalDiscount;
  console.log(`✓ Global discount (10%): ${globalDiscountValid ? '✅' : '❌'}`);
  console.log(`  Expected: €${expectedGlobalDiscount.toLocaleString('it-IT')} | Actual: €${p.globalDiscountSavings.toLocaleString('it-IT')}`);
  
  // Test 3: Final total calculation
  const expectedFinalTotal = p.subtotal - p.globalDiscountSavings;
  const finalTotalValid = p.finalTotal === expectedFinalTotal;
  console.log(`✓ Final total calculation: ${finalTotalValid ? '✅' : '❌'}`);
  console.log(`  Expected: €${expectedFinalTotal.toLocaleString('it-IT')} | Actual: €${p.finalTotal.toLocaleString('it-IT')}`);
  
  // Test 4: Total savings calculation
  const expectedTotalSavings = p.globalDiscountSavings + p.individualDiscountSavings + p.giftSavings;
  const totalSavingsValid = p.totalSavings === expectedTotalSavings;
  console.log(`✓ Total savings calculation: ${totalSavingsValid ? '✅' : '❌'}`);
  console.log(`  Expected: €${expectedTotalSavings.toLocaleString('it-IT')} | Actual: €${p.totalSavings.toLocaleString('it-IT')}`);
  
  console.log('\n');
  
  return {
    subtotalValid,
    globalDiscountValid,
    finalTotalValid,
    totalSavingsValid,
    allValid: subtotalValid && globalDiscountValid && finalTotalValid && totalSavingsValid
  };
}

function generateComponentChecks() {
  console.log('🔍 CHECKS PER COMPONENTE:');
  console.log('==========================');
  
  const p = unifiedPricingStructure;
  
  console.log('1. CHAT CONVERSAZIONALE (DynamicChatGuide):');
  console.log('   - Verifica che il messaggio finale mostri:');
  console.log(`     "Totale finale: €${p.finalTotal.toLocaleString('it-IT')}"`);
  console.log(`     "RISPARMI TOTALI: €${p.totalSavings.toLocaleString('it-IT')}"`);
  
  console.log('\n2. CHECKOUT MODAL:');
  console.log('   - pricing.subtotal deve essere:', p.subtotal);
  console.log('   - pricing.total deve essere:', p.finalTotal);
  console.log('   - pricing.detailed.globalDiscountSavings deve essere:', p.globalDiscountSavings);
  
  console.log('\n3. LEAD FORM (quando salva):');
  console.log('   - pricing.subtotal deve essere:', p.subtotal, '(NON originalSubtotal!)');
  console.log('   - pricing.detailed.globalDiscountSavings deve essere:', p.globalDiscountSavings);
  console.log('   - pricing.total deve essere:', p.finalTotal);
  
  console.log('\n4. ADMIN PANEL (LeadsManagement):');
  console.log('   - Deve leggere pricing.detailed.globalDiscountSavings');
  console.log('   - TOTALE deve mostrare:', p.finalTotal);
  console.log(`   - Non deve mostrare €${p.originalSubtotal.toLocaleString('it-IT')} da nessuna parte!`);
  
  console.log('\n5. WHATSAPP MESSAGE:');
  console.log('   - Deve usare formatPricingSummary() con leadPricing.detailed');
  console.log(`   - TOTALE deve mostrare: €${p.finalTotal.toLocaleString('it-IT')}`);
  console.log(`   - Sconto globale deve mostrare: -€${p.globalDiscountSavings.toLocaleString('it-IT')}`);
  
  console.log('\n6. PDF GENERATION:');
  console.log('   - Deve usare pricing.detailed.globalDiscountSavings se disponibile');
  console.log(`   - TOTALE deve mostrare: €${p.finalTotal.toLocaleString('it-IT')}`);
  
  console.log('\n');
}

function identifyCommonIssues() {
  console.log('🚨 PROBLEMI COMUNI E SOLUZIONI:');
  console.log('================================');
  
  console.log('❌ PROBLEMA: Admin/WhatsApp mostrano €3.150 invece di €2.750');
  console.log('   🔧 CAUSA: Uso di originalSubtotal invece di subtotal');
  console.log('   ✅ SOLUZIONE: Usare sempre leadPricing.subtotal per il salvataggio');
  
  console.log('\n❌ PROBLEMA: Sconto globale -€350 invece di -€315');
  console.log('   🔧 CAUSA: Calcolo su originalSubtotal (3500) invece di subtotal (3150)');
  console.log('   ✅ SOLUZIONE: Calcolare 10% di subtotal, non di originalSubtotal');
  
  console.log('\n❌ PROBLEMA: Struttura pricing.detailed mancante');
  console.log('   🔧 CAUSA: Lead salvato senza detailed object');
  console.log('   ✅ SOLUZIONE: Includere detailed nel salvataggio lead');
  
  console.log('\n❌ PROBLEMA: Servizi gratis senza badge');
  console.log('   🔧 CAUSA: Controllo item.isGift invece di price === 0');
  console.log('   ✅ SOLUZIONE: Usare item.price === 0 && originalPrice > 0');
  
  console.log('\n');
}

// Esegui analisi completa
analyzeComponents();
const validation = validateCalculations();
generateComponentChecks();
identifyCommonIssues();

console.log('📋 RISULTATO VALIDAZIONE:');
console.log('==========================');
if (validation.allValid) {
  console.log('🎉 Tutti i calcoli sono matematicamente corretti!');
  console.log('🎯 Se i componenti mostrano valori diversi, il problema è nell\'implementazione');
} else {
  console.log('⚠️  Ci sono errori nei calcoli base - verifica la logica di pricing');
}

console.log('\n🔧 Per eseguire: node debug-pricing-components.js');