import { useState, useEffect, useCallback } from 'react';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { GuideStep, LeadData, GuideState, AvatarType } from './types';
import type { Settings, Discounts, Item } from '@shared/schema';

export function useImprovedGuideLogic() {
  const cart = useCartWithRules();
  const [guideState, setGuideState] = useState<GuideState>({
    currentStep: 0,
    isActive: false,
    leadData: {}
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [discounts, setDiscounts] = useState<Discounts>({});

  // Load backend data
  useEffect(() => {
    async function loadBackendData() {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'studio'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as Settings);
        }

        const discountsDoc = await getDoc(doc(db, 'settings', 'discounts'));
        if (discountsDoc.exists()) {
          setDiscounts(discountsDoc.data() as Discounts);
        }
      } catch (error) {
        console.error("Error loading backend data:", error);
      }
    }
    
    loadBackendData();
  }, []);

  // Generate improved guide steps with clear progression
  const generateSteps = useCallback((): GuideStep[] => {
    const studioName = settings?.studioName || "Studio Demo";
    const globalDiscount = discounts?.global;
    const hasGlobalDiscount = globalDiscount?.isActive && globalDiscount?.value;
    
    return [
      // Step 0: Welcome & Name
      {
        id: 'welcome',
        avatar: 'smiling',
        message: `Ciao! Sono Gennaro di ${studioName}, il tuo assistente virtuale per il matrimonio. 

Ti guiderò step by step per creare il preventivo perfetto, spiegandoti tutti i trucchi per risparmiare e sbloccare regali speciali!

Come ti chiami?`,
        actions: [{
          id: 'name',
          label: 'Il tuo nome',
          type: 'input',
          required: true,
          action: (value: string) => {
            setGuideState(prev => ({
              ...prev,
              leadData: { ...prev.leadData, name: value },
              currentStep: prev.currentStep + 1
            }));
          }
        }],
        canProceed: () => !!guideState.leadData.name
      },

      // Step 1: Discount announcement
      {
        id: 'discounts_intro',
        avatar: 'enthusiastic',
        confetti: true,
        message: hasGlobalDiscount 
          ? `Ciao ${guideState.leadData.name}! 🎉 HAI SCELTO IL MOMENTO PERFETTO!

È attivo uno SCONTO GLOBALE del ${globalDiscount?.value}% su tutto il carrello!

Ma aspetta... c'è di più! Ogni prodotto ha SCONTI AGGIUNTIVI che si sommano, più selezioni e più risparmi!

Pronto a scoprire come funziona?`
          : `Perfetto ${guideState.leadData.name}! 

Abbiamo preparato SCONTI SPECIALI su tutti i nostri servizi premium. Ti spiegherò come sbloccare regali e massimizzare il tuo risparmio!

Iniziamo?`,
        actions: [{
          id: 'continue',
          label: hasGlobalDiscount ? 'Spiegami tutto!' : 'Sono pronto!',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }]
      },

      // Step 2: Wedding date (required)
      {
        id: 'wedding_date',
        avatar: 'explaining',
        message: `Ora ${guideState.leadData.name}, ho bisogno della data del matrimonio.

Questo mi serve per:
🎯 Verificare la nostra disponibilità
🌤️ Consigliarti i servizi migliori in base alla stagione
💰 Applicare eventuali sconti stagionali

Quando ti sposi?`,
        actions: [{
          id: 'eventDate',
          label: 'Seleziona data nozze',
          type: 'datepicker',
          required: true,
          action: (date: Date) => {
            setGuideState(prev => ({
              ...prev,
              leadData: { ...prev.leadData, eventDate: date.toISOString() },
              currentStep: prev.currentStep + 1
            }));
          }
        }],
        canProceed: () => !!guideState.leadData.eventDate
      },

      // Step 3: Services explanation
      {
        id: 'services_intro',
        avatar: 'explaining',
        message: `Perfetto! Ora ti spiego le REGOLE D'ORO per risparmiare sui nostri servizi:

🎥 **REGOLA VIDEOMAKER**: Se scegli "Videomaker", si sbloccano automaticamente "Riprese Drone" e "Videoproiezione" a prezzi speciali!

📸 **REGOLA FOTOGRAFICO**: Se scegli "Servizio Fotografico", si sbloccano TUTTI i prodotti fotografici (Album, Foto Invitati, ecc.)

🎁 **SUPER REGALO**: Con il pacchetto completo (tutti e 7 i prodotti), "Foto Invitati" diventa GRATIS!

Vuoi vedere i servizi disponibili?`,
        actions: [{
          id: 'show_services',
          label: 'Sì, mostrami i servizi!',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }]
      },

      // Step 4: Services selection (requires action)
      {
        id: 'services_selection',
        avatar: 'smiling',
        message: `Ecco tutti i nostri SERVIZI! 

Clicca su quelli che ti interessano. Vedrai in tempo reale:
✨ Quali prodotti si sbloccano
💰 Come cambiano i prezzi
🎁 Quando attivi i regali

**DEVI SCEGLIERE ALMENO UN SERVIZIO per continuare!**`,
        uiHint: 'show_services_inline',
        requiresAction: true,
        canProceed: () => cart.cart.items.some(item => item.category === 'servizio'),
        actions: [{
          id: 'continue_to_products',
          label: 'Ho scelto i servizi, continua!',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          },
          disabled: () => !cart.cart.items.some(item => item.category === 'servizio')
        }]
      },

      // Step 5: Products explanation
      {
        id: 'products_intro',
        avatar: 'excited',
        message: `Bravo ${guideState.leadData.name}! Hai scelto: ${cart.cart.items.filter(item => item.category === 'servizio').map(item => item.name).join(', ')}

Ora vediamo i PRODOTTI che si sono sbloccati grazie alle tue scelte!

${cart.cart.items.some(item => item.name.includes('Fotografico')) ? 
  '📸 Perfetto! Hai sbloccato TUTTI i prodotti fotografici!' : 
  '⚠️ Nota: Alcuni prodotti fotografici sono ancora bloccati (serve il Servizio Fotografico)'}

${cart.cart.items.some(item => item.name.includes('Videomaker')) ? 
  '🎥 Fantastico! Hai sbloccato Drone e Videoproiezione!' : 
  '⚠️ Nota: Drone e Videoproiezione sono bloccati (serve il Videomaker)'}

Pronto a scegliere i prodotti?`,
        actions: [{
          id: 'show_products',
          label: 'Mostrami i prodotti!',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }]
      },

      // Step 6: Products selection (optional but recommended)
      {
        id: 'products_selection',
        avatar: 'explaining',
        message: `Ecco tutti i PRODOTTI disponibili!

I prodotti con sfondo VERDE sono già sbloccati dalle tue scelte.
I prodotti GRIGI sono bloccati (ti mancano i servizi base).

💡 **CONSIGLIO**: Se selezioni tutti i prodotti del pacchetto completo, "Foto Invitati" diventa GRATIS!

Scegli quelli che ti interessano:`,
        uiHint: 'show_products_inline',
        actions: [{
          id: 'continue_to_summary',
          label: 'Continua con questi prodotti',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }]
      },

      // Step 7: Summary and pricing
      {
        id: 'summary',
        avatar: 'thoughtful',
        message: `Perfetto ${guideState.leadData.name}! Ecco il riepilogo delle tue scelte:

${cart.cart.items.length > 0 ? 
  `Hai selezionato ${cart.cart.items.length} elementi per un totale di €${cart.getPricingWithRules().finalTotal}` :
  'Non hai ancora selezionato nulla - torna indietro per scegliere!'
}

${cart.cart.items.some(item => item.price === 0 && item.originalPrice) ?
  '🎁 CONGRATULAZIONI! Hai sbloccato degli OMAGGI!' :
  ''
}

Vuoi procedere con il preventivo o modificare le tue scelte?`,
        uiHint: 'show_cart_inline',
        actions: [
          {
            id: 'modify_selection',
            label: 'Modifica selezioni',
            type: 'button',
            action: () => {
              setGuideState(prev => ({ ...prev, currentStep: 3 })); // Torna ai servizi
            }
          },
          {
            id: 'continue_to_lead',
            label: 'Procedi al preventivo!',
            type: 'button',
            action: () => {
              setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
            },
            disabled: () => cart.cart.items.length === 0
          }
        ]
      },

      // Step 8: Lead collection
      {
        id: 'lead_collection',
        avatar: 'smiling',
        message: `Perfetto! Ora ho bisogno di alcuni tuoi dati per preparare il preventivo personalizzato e contattarti con tutte le informazioni.

Compila i campi qui sotto:`,
        canProceed: () => !!(guideState.leadData.name && guideState.leadData.email && guideState.leadData.phone)
      },

      // Step 9: Final thank you
      {
        id: 'final',
        avatar: 'enthusiastic',
        confetti: true,
        message: `🎉 FANTASTICO ${guideState.leadData.name}!

Il tuo preventivo è pronto! 

📧 Ti invieremo tutti i dettagli via email
📱 Ti contatteremo presto per finalizzare tutto
💰 Totale finale: €${cart.getPricingWithRules().finalTotal}

Grazie per aver scelto ${studioName}!`,
        actions: [{
          id: 'restart',
          label: 'Ricomincia per un nuovo preventivo',
          type: 'button',
          action: () => {
            cart.clearCart();
            setGuideState({
              currentStep: 0,
              isActive: true,
              leadData: {}
            });
          }
        }]
      }
    ];
  }, [settings, discounts, guideState.leadData, cart]);

  const startGuide = () => {
    setGuideState(prev => ({ ...prev, isActive: true }));
  };

  const getCurrentStep = (): GuideStep | null => {
    const steps = generateSteps();
    return steps[guideState.currentStep] || null;
  };

  const canProceedToNext = (): boolean => {
    const currentStep = getCurrentStep();
    if (!currentStep) return false;
    
    if (currentStep.canProceed) {
      return currentStep.canProceed();
    }
    
    if (currentStep.requiresAction && currentStep.canProceed) {
      return currentStep.canProceed();
    }
    
    return true;
  };

  const nextStep = () => {
    if (!canProceedToNext()) return;
    
    const steps = generateSteps();
    if (guideState.currentStep < steps.length - 1) {
      setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const prevStep = () => {
    if (guideState.currentStep > 0) {
      setGuideState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  return {
    guideState,
    setGuideState,
    startGuide,
    getCurrentStep,
    canProceedToNext,
    nextStep,
    prevStep,
    generateSteps
  };
}