#!/usr/bin/env node

/**
 * Script di verifica per l'allineamento dei calcoli di pricing
 * Analizza il codice sorgente dei componenti per verificare coerenza
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 VERIFICA ALLINEAMENTO CALCOLI PRICING - ANALISI CODICE');
console.log('=========================================================\n');

// Componenti da analizzare
const componentsToAnalyze = [
  {
    name: 'DynamicChatGuide',
    path: 'client/src/components/ConversationalGuide/DynamicChatGuide.tsx',
    description: 'Chat conversazionale principale'
  },
  {
    name: 'LeadForm', 
    path: 'client/src/components/ConversationalGuide/LeadForm.tsx',
    description: 'Form finale per salvataggio lead'
  },
  {
    name: 'CheckoutModal',
    path: 'client/src/components/CheckoutModal.tsx', 
    description: 'Modale di checkout con riepilogo prezzi'
  },
  {
    name: 'LeadsManagement',
    path: 'client/src/components/admin/LeadsManagement.tsx',
    description: 'Pannello admin per gestione lead'
  },
  {
    name: 'unifiedPricing',
    path: 'client/src/lib/unifiedPricing.ts',
    description: 'Sistema di calcolo unificato'
  },
  {
    name: 'useCartWithRules',
    path: 'client/src/hooks/useCartWithRules.tsx',
    description: 'Hook per gestione carrello con regole'
  }
];

// Funzione per leggere il codice sorgente
function readSourceCode(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

// Analisi del codice sorgente per patterns di pricing
function analyzePricingPatterns(sourceCode, componentName) {
  const analysis = {
    component: componentName,
    usesUnifiedPricing: false,
    usesSubtotal: false,
    usesOriginalSubtotal: false,
    usesDetailedObject: false,
    usesGlobalDiscountSavings: false,
    pricingCalculations: [],
    issues: []
  };

  if (!sourceCode) {
    analysis.issues.push('File non trovato');
    return analysis;
  }

  // Pattern da cercare
  const patterns = {
    unifiedPricing: /import.*unifiedPricing|calculateUnifiedPricing|formatPricingSummary/g,
    subtotal: /\.subtotal(?!\w)/g,
    originalSubtotal: /\.originalSubtotal/g,
    detailedObject: /\.detailed\.|pricing\.detailed/g,
    globalDiscountSavings: /globalDiscountSavings/g,
    totalCalculation: /total.*=|pricing\.total/g,
    pricingDisplay: /€.*\{.*\}|toLocaleString.*'it-IT'/g
  };

  // Analizza patterns
  analysis.usesUnifiedPricing = (patterns.unifiedPricing.exec(sourceCode) !== null);
  analysis.usesSubtotal = (patterns.subtotal.exec(sourceCode) !== null);
  analysis.usesOriginalSubtotal = (patterns.originalSubtotal.exec(sourceCode) !== null);
  analysis.usesDetailedObject = (patterns.detailedObject.exec(sourceCode) !== null);
  analysis.usesGlobalDiscountSavings = (patterns.globalDiscountSavings.exec(sourceCode) !== null);

  // Trova calcoli di pricing specifici
  const lines = sourceCode.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('pricing') && (line.includes('=') || line.includes('€'))) {
      analysis.pricingCalculations.push({
        line: index + 1,
        code: line.trim()
      });
    }
  });

  // Identifica problemi comuni
  if (analysis.usesOriginalSubtotal && componentName !== 'unifiedPricing') {
    analysis.issues.push('⚠️ Usa originalSubtotal invece di subtotal (potenziale bug)');
  }

  if (!analysis.usesDetailedObject && ['LeadForm', 'LeadsManagement'].includes(componentName)) {
    analysis.issues.push('⚠️ Non usa pricing.detailed (dati incompleti per admin/WhatsApp)');
  }

  if (!analysis.usesUnifiedPricing && ['DynamicChatGuide', 'LeadForm'].includes(componentName)) {
    analysis.issues.push('⚠️ Non usa sistema unificato (possibili inconsistenze)');
  }

  return analysis;
}

// Analisi completa di tutti i componenti
function analyzeAllComponents() {
  console.log('📋 ANALISI COMPONENTI PRICING:');
  console.log('===============================\n');
  
  const results = [];
  
  componentsToAnalyze.forEach(component => {
    console.log(`🔍 Analizzando: ${component.name}`);
    console.log(`   File: ${component.path}`);
    console.log(`   Descrizione: ${component.description}`);
    
    const sourceCode = readSourceCode(component.path);
    const analysis = analyzePricingPatterns(sourceCode, component.name);
    results.push(analysis);
    
    // Mostra risultati dell'analisi
    console.log(`   ✓ Usa sistema unificato: ${analysis.usesUnifiedPricing ? '✅' : '❌'}`);
    console.log(`   ✓ Usa subtotal corretto: ${analysis.usesSubtotal ? '✅' : '❌'}`);
    console.log(`   ✓ Usa pricing.detailed: ${analysis.usesDetailedObject ? '✅' : '❌'}`);
    console.log(`   ✓ Usa globalDiscountSavings: ${analysis.usesGlobalDiscountSavings ? '✅' : '❌'}`);
    
    if (analysis.usesOriginalSubtotal) {
      console.log(`   ⚠️  ATTENZIONE: Usa originalSubtotal (potenziale bug)`);
    }
    
    if (analysis.issues.length > 0) {
      console.log(`   🚨 PROBLEMI TROVATI:`);
      analysis.issues.forEach(issue => {
        console.log(`      ${issue}`);
      });
    }
    
    if (analysis.pricingCalculations.length > 0) {
      console.log(`   📊 Calcoli pricing trovati:`);
      analysis.pricingCalculations.slice(0, 3).forEach(calc => {
        console.log(`      Linea ${calc.line}: ${calc.code}`);
      });
      if (analysis.pricingCalculations.length > 3) {
        console.log(`      ... e ${analysis.pricingCalculations.length - 3} altri`);
      }
    }
    
    console.log('');
  });
  
  return results;
}

// Genera report finale
function generateFinalReport(results) {
  console.log('📊 REPORT FINALE ALLINEAMENTO PRICING:');
  console.log('======================================\n');
  
  const criticalIssues = results.filter(r => r.issues.length > 0);
  const goodComponents = results.filter(r => r.usesUnifiedPricing && r.usesDetailedObject);
  
  if (criticalIssues.length === 0) {
    console.log('🎉 OTTIMO! Nessun problema critico trovato nel codice');
    console.log('✅ Tutti i componenti sembrano usare la logica corretta\n');
  } else {
    console.log('🚨 PROBLEMI CRITICI TROVATI:');
    console.log('============================');
    criticalIssues.forEach(component => {
      console.log(`\n❌ ${component.component}:`);
      component.issues.forEach(issue => {
        console.log(`   ${issue}`);
      });
    });
    console.log('');
  }
  
  console.log('📋 VALUTAZIONE COMPONENTI:');
  console.log('===========================');
  
  results.forEach(result => {
    const score = [
      result.usesUnifiedPricing,
      result.usesSubtotal,
      result.usesDetailedObject,
      result.usesGlobalDiscountSavings,
      !result.usesOriginalSubtotal
    ].filter(Boolean).length;
    
    const grade = score >= 4 ? '🟢' : score >= 3 ? '🟡' : '🔴';
    console.log(`${grade} ${result.component.padEnd(20)} Score: ${score}/5`);
  });
  
  console.log('\n🎯 VALORI TARGET ATTESI OVUNQUE:');
  console.log('=================================');
  console.log('• Subtotal servizi a pagamento: €3.050');
  console.log('• Sconto globale (-10%): -€305');
  console.log('• Servizi in omaggio: -€450');
  console.log('• TOTALE FINALE: €2.745');
  console.log('• Totale risparmiato: €755');
  
  console.log('\n📋 CHECKLIST VERIFICA MANUALE:');
  console.log('===============================');
  console.log('□ Crea nuovo lead con 7 servizi (1 gratis)');
  console.log('□ Chat mostra totale €2.745');
  console.log('□ Admin mostra totale €2.745');
  console.log('□ WhatsApp mostra totale €2.745');
  console.log('□ PDF mostra totale €2.745');
  console.log('□ Sconto globale -€305 ovunque');
  console.log('□ Servizi omaggio -€450 ovunque');
  console.log('□ "Foto per Invitati" ha badge GRATIS');
  
  console.log('\n🔧 PROSSIMI PASSI:');
  console.log('==================');
  if (criticalIssues.length > 0) {
    console.log('1. 🔴 Risolvi i problemi critici sopra elencati');
    console.log('2. 🔄 Esegui di nuovo questo script');
    console.log('3. 🧪 Testa manualmente i componenti');
  } else {
    console.log('1. ✅ Il codice sembra corretto');
    console.log('2. 🧪 Procedi con test manuali');
    console.log('3. 📝 Verifica che i valori corrispondano');
  }
}

// Esegui analisi completa
const analysisResults = analyzeAllComponents();
generateFinalReport(analysisResults);

console.log('\n🔧 Per eseguire: node verify-pricing-alignment.js');