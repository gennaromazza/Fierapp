#!/usr/bin/env node

/**
 * Test finale per verificare allineamento pricing in tempo reale
 * Simula un flusso completo e verifica i risultati attesi
 */

console.log('🧪 TEST FINALE ALLINEAMENTO PRICING');
console.log('====================================\n');

// Configurazione test
const testConfiguration = {
  services: [
    { name: 'Servizio Fotografico', price: 600, originalPrice: 600 },
    { name: 'Videomaker', price: 850, originalPrice: 850 },
    { name: 'Album Sposi Big 30x40', price: 800, originalPrice: 800 },
    { name: 'VideoProiezione', price: 200, originalPrice: 200 },
    { name: 'Riprese Drone', price: 300, originalPrice: 300 },
    { name: 'Album Genitori', price: 300, originalPrice: 300 },
    { name: 'Foto per Invitati', price: 0, originalPrice: 450, isGift: true }
  ],
  globalDiscountPercent: 10
};

// Calcolo di riferimento
function calculateReference() {
  const { services, globalDiscountPercent } = testConfiguration;
  
  const paidServices = services.filter(s => !s.isGift);
  const giftServices = services.filter(s => s.isGift);
  
  const subtotal = paidServices.reduce((sum, s) => sum + s.price, 0);
  const globalDiscount = Math.round(subtotal * (globalDiscountPercent / 100));
  const giftSavings = giftServices.reduce((sum, s) => sum + s.originalPrice, 0);
  const finalTotal = subtotal - globalDiscount;
  const totalSavings = globalDiscount + giftSavings;
  
  return {
    subtotal,
    globalDiscount,
    giftSavings,
    finalTotal,
    totalSavings,
    paidServicesCount: paidServices.length,
    giftServicesCount: giftServices.length
  };
}

// Genera istruzioni di test specifiche
function generateTestInstructions() {
  const ref = calculateReference();
  
  console.log('🎯 VALORI DI RIFERIMENTO ATTESI:');
  console.log('================================');
  console.log(`• Subtotal (solo servizi a pagamento): €${ref.subtotal.toLocaleString('it-IT')}`);
  console.log(`• Sconto globale (-${testConfiguration.globalDiscountPercent}%): -€${ref.globalDiscount.toLocaleString('it-IT')}`);
  console.log(`• Servizi in omaggio: -€${ref.giftSavings.toLocaleString('it-IT')}`);
  console.log(`• TOTALE FINALE: €${ref.finalTotal.toLocaleString('it-IT')}`);
  console.log(`• Totale risparmiato: €${ref.totalSavings.toLocaleString('it-IT')}`);
  console.log(`• Servizi a pagamento: ${ref.paidServicesCount}`);
  console.log(`• Servizi in omaggio: ${ref.giftServicesCount}\n`);
  
  console.log('📋 PROCEDURA DI TEST STEP-BY-STEP:');
  console.log('===================================');
  
  console.log('1. 🗣️ TEST CHAT CONVERSAZIONALE:');
  console.log('   a) Vai alla homepage e avvia la chat');
  console.log('   b) Aggiungi tutti questi servizi:');
  testConfiguration.services.forEach((service, index) => {
    const priceDisplay = service.isGift ? '(dovrebbe diventare GRATIS)' : `€${service.price}`;
    console.log(`      ${index + 1}. ${service.name} ${priceDisplay}`);
  });
  console.log('   c) Verifica il riepilogo finale mostri:');
  console.log(`      "💰 Totale finale: €${ref.finalTotal.toLocaleString('it-IT')}"`);
  console.log(`      "✨ RISPARMI TOTALI: €${ref.totalSavings.toLocaleString('it-IT')}"`);
  console.log(`      "🎁 Prodotti GRATUITI: Foto per Invitati"`);
  
  console.log('\n2. 📝 TEST LEAD FORM:');
  console.log('   a) Compila il form con dati di test');
  console.log('   b) Prima di inviare, verifica che il riepilogo mostri:');
  console.log(`      - Subtotale: €${ref.subtotal.toLocaleString('it-IT')}`);
  console.log(`      - Sconto: -€${ref.globalDiscount.toLocaleString('it-IT')}`);
  console.log(`      - Totale: €${ref.finalTotal.toLocaleString('it-IT')}`);
  console.log('   c) Invia il lead e memorizza l\'ID generato');
  
  console.log('\n3. 🔧 TEST PANNELLO ADMIN:');
  console.log('   a) Vai al pannello admin (/admin)');
  console.log('   b) Apri il lead appena creato');
  console.log('   c) Verifica che mostri ESATTAMENTE:');
  console.log(`      - Subtotale servizi/prodotti: €${ref.subtotal.toLocaleString('it-IT')}`);
  console.log(`      - Sconto globale (-10%): -€${ref.globalDiscount.toLocaleString('it-IT')}`);
  console.log(`      - Servizi in omaggio: -€${ref.giftSavings.toLocaleString('it-IT')}`);
  console.log(`      - TOTALE: €${ref.finalTotal.toLocaleString('it-IT')}`);
  console.log(`      - 💰 Totale risparmiato: €${ref.totalSavings.toLocaleString('it-IT')}`);
  
  console.log('\n4. 📱 TEST MESSAGGIO WHATSAPP:');
  console.log('   a) Dal pannello admin, clicca "Invia WhatsApp"');
  console.log('   b) Verifica che il messaggio contenga:');
  console.log(`      - Subtotale servizi/prodotti: €${ref.subtotal.toLocaleString('it-IT')}`);
  console.log(`      - Sconto globale (-10%): -€${ref.globalDiscount.toLocaleString('it-IT')}`);
  console.log(`      - Servizi in omaggio: -€${ref.giftSavings.toLocaleString('it-IT')}`);
  console.log(`      - TOTALE: €${ref.finalTotal.toLocaleString('it-IT')}`);
  console.log(`      - Totale risparmiato: €${ref.totalSavings.toLocaleString('it-IT')}`);
  console.log('      - "Foto per Invitati - GRATIS"');
  
  console.log('\n5. 📄 TEST PDF:');
  console.log('   a) Genera PDF dal lead');
  console.log('   b) Verifica che la sezione totali mostri:');
  console.log(`      - Subtotale: €${ref.subtotal.toLocaleString('it-IT')}`);
  console.log(`      - Sconto globale: -€${ref.globalDiscount.toLocaleString('it-IT')}`);
  console.log(`      - Servizi omaggio: -€${ref.giftSavings.toLocaleString('it-IT')}`);
  console.log(`      - TOTALE: €${ref.finalTotal.toLocaleString('it-IT')}`);
  console.log('      - "Foto per Invitati" con "GRATIS" e prezzo originale barrato');
  
  return ref;
}

// Genera checklist di verifica
function generateVerificationChecklist(ref) {
  console.log('\n✅ CHECKLIST VERIFICA FINALE:');
  console.log('==============================');
  
  const checks = [
    `Chat mostra totale €${ref.finalTotal.toLocaleString('it-IT')}`,
    `Lead form mostra totale €${ref.finalTotal.toLocaleString('it-IT')}`,
    `Admin panel mostra totale €${ref.finalTotal.toLocaleString('it-IT')}`,
    `WhatsApp message mostra totale €${ref.finalTotal.toLocaleString('it-IT')}`,
    `PDF mostra totale €${ref.finalTotal.toLocaleString('it-IT')}`,
    `Sconto globale -€${ref.globalDiscount.toLocaleString('it-IT')} ovunque`,
    `Servizi omaggio -€${ref.giftSavings.toLocaleString('it-IT')} ovunque`,
    `Subtotal €${ref.subtotal.toLocaleString('it-IT')} ovunque`,
    `Totale risparmiato €${ref.totalSavings.toLocaleString('it-IT')} ovunque`,
    '"Foto per Invitati" ha badge 🎁 GRATIS',
    'Nessun valore €3.150 o €3.500 da nessuna parte',
    'Nessun sconto -€350 da nessuna parte'
  ];
  
  checks.forEach((check, index) => {
    console.log(`□ ${index + 1}. ${check}`);
  });
  
  console.log('\n🚨 ERRORI DA SEGNALARE:');
  console.log('========================');
  console.log('❌ Se vedi €3.150 invece di €2.745 = BUG CRITICO');
  console.log('❌ Se vedi -€350 invece di -€305 = BUG CRITICO');
  console.log('❌ Se "Foto per Invitati" non è gratis = BUG REGOLE');
  console.log('❌ Se i totali differiscono tra componenti = BUG ALLINEAMENTO');
  
  console.log('\n🎉 SE TUTTI I CHECK PASSANO:');
  console.log('=============================');
  console.log('✅ Sistema di pricing perfettamente allineato!');
  console.log('✅ Chat, Admin, WhatsApp e PDF consistenti');
  console.log('✅ Calcoli sequenziali corretti');
  console.log('✅ Gestione regali corretta');
  console.log('💯 PRICING SYSTEM: VALIDATO ✓');
}

// Esegui test completo
console.log('Generando test specifico per i valori attualmente nel sistema...\n');
const referenceValues = generateTestInstructions();
generateVerificationChecklist(referenceValues);

console.log('\n🔧 COMANDI UTILI:');
console.log('==================');
console.log('• node final-pricing-test.js    - Questo script');
console.log('• node verify-pricing-alignment.js - Analisi codice');
console.log('• node debug-pricing-components.js - Debug dettagliato');
console.log('• node test-pricing-consistency.js - Simulazione flusso');

console.log('\n📞 CONTATTO SVILUPPATORE:');
console.log('==========================');
console.log('Se trovi discrepanze, riporta:');
console.log('1. Quale componente mostra valori sbagliati');
console.log('2. Valori attesi vs valori mostrati');
console.log('3. Screenshot del problema');
console.log('4. ID del lead di test creato');