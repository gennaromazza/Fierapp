import { useState, useCallback, useEffect } from 'react';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { GuideStep, LeadData, GuideState, AvatarType } from './types';
import type { Settings, Discounts, Item } from '../../../shared/schema';

export function useGuideLogic() {
  const cart = useCartWithRules();
  const [guideState, setGuideState] = useState<GuideState>({
    currentStep: 0,
    leadData: {},
    isActive: false,
    showChat: false,
  });
  
  const [settings, setSettings] = useState<Settings | null>(null);
  const [discounts, setDiscounts] = useState<Discounts | null>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);

  // Load backend data
  useEffect(() => {
    async function loadBackendData() {
      try {
        const [settingsDoc, discountsDoc] = await Promise.all([
          getDoc(doc(db, "settings", "app")),
          getDoc(doc(db, "settings", "discounts"))
        ]);

        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as Settings);
        }
        if (discountsDoc.exists()) {
          setDiscounts(discountsDoc.data() as Discounts);
        }
      } catch (error) {
        console.error("Error loading backend data:", error);
      }
    }
    
    loadBackendData();
  }, []);

  // Generate dynamic guide steps based on backend data
  const generateSteps = useCallback((): GuideStep[] => {
    const studioName = settings?.studioName || "Studio Demo";
    const globalDiscount = discounts?.global;
    const hasGlobalDiscount = globalDiscount?.isActive && globalDiscount?.value;
    
    return [
      // Step 0: Welcome & Name
      {
        id: 'welcome',
        avatar: 'smiling',
        message: `Ciao, sono Gennaro di ${studioName}. Sono il tuo assistente personale: ti aiuto a compilare il preventivo per il servizio fotografico del tuo matrimonio. Come ti chiami?`,
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
        }]
      },

      // Step 1: Announce discounts with confetti
      {
        id: 'discounts',
        avatar: 'smiling',
        confetti: true,
        message: hasGlobalDiscount 
          ? `Perfetto, ${guideState.leadData.name || 'amico'}! Per l'occasione è attivo uno sconto globale del ${globalDiscount?.value}% che termina il ${globalDiscount?.endDate ? new Date(globalDiscount.endDate).toLocaleDateString('it-IT') : 'presto'}. E non solo: abbiamo sconti anche sui singoli prodotti/servizi (controlla i badge rossi nelle card).`
          : `Perfetto, ${guideState.leadData.name || 'amico'}! Abbiamo sconti speciali sui nostri servizi (controlla i badge rossi nelle card).`,
        actions: [{
          id: 'continue',
          label: 'Continua',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_global_discount'
      },

      // Step 2: Wedding date
      {
        id: 'wedding_date',
        avatar: 'smiling',
        message: 'Iniziamo: mi dici la data delle nozze? Per noi è fondamentale.',
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
        }]
      },

      // Step 3: Service selection
      {
        id: 'services',
        avatar: 'neutral',
        message: `Perfetto, ${guideState.leadData.name}. La prima cosa da scegliere sono i Servizi. Se selezioni il Servizio Fotografico, sblocchi tutti gli altri prodotti.`,
        actions: [{
          id: 'continue_services',
          label: 'Vai ai Servizi',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_services_tab'
      },

      // Step 4: Products
      {
        id: 'products',
        avatar: 'neutral',
        message: 'Ottimo! Ora passiamo ai Prodotti (album, foto per invitati, ecc.).',
        actions: [{
          id: 'continue_products',
          label: 'Vai ai Prodotti',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_products_tab'
      },

      // Step 5: Upsell
      {
        id: 'upsell',
        avatar: 'enthusiastic',
        message: 'Per completare al meglio, ti suggerisco i preferiti dagli sposi: Videomaker, Riprese Drone, Foto per Invitati. Li aggiungo?',
        actions: [
          {
            id: 'add_recommended',
            label: 'Aggiungi consigliati',
            type: 'button',
            action: () => {
              // Logic to add recommended items
              setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
            }
          },
          {
            id: 'skip_recommended',
            label: 'Scelgo io',
            type: 'button',
            action: () => {
              setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
            }
          }
        ]
      },

      // Step 6: Summary
      {
        id: 'summary',
        avatar: 'neutral',
        message: hasGlobalDiscount 
          ? `Ecco il tuo riepilogo. Hai sconto globale del ${globalDiscount?.value}% fino al ${globalDiscount?.endDate ? new Date(globalDiscount.endDate).toLocaleDateString('it-IT') : 'presto'} + sconti prodotto già conteggiati nel carrello.`
          : 'Ecco il tuo riepilogo con tutti gli sconti prodotto già conteggiati nel carrello.',
        actions: [{
          id: 'continue_summary',
          label: 'Continua',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_cart'
      },

      // Step 7: Gifts/Savings
      {
        id: 'savings',
        avatar: 'enthusiastic',
        message: `Guarda quanto hai risparmiato: €${cart.getPricingWithRules().totalSavings} tra sconto globale e sconti prodotto. Niente male! 😄`,
        actions: [{
          id: 'continue_checkout',
          label: 'Procedi al checkout',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_savings'
      },

      // Step 8: Lead collection
      {
        id: 'lead_collection',
        avatar: 'smiling',
        message: 'Perfetto! Ora ho bisogno di alcuni tuoi dati per inviarti il preventivo.',
        actions: [], // Will be handled by a special lead form component
        uiHint: 'show_lead_form'
      },

      // Step 9: Closure
      {
        id: 'closure',
        avatar: 'smiling',
        message: `Grazie, ${guideState.leadData.name}! Ti ho inviato il riepilogo. Preferisci scrivermi su WhatsApp o fissare un appuntamento?`,
        actions: [
          {
            id: 'whatsapp',
            label: 'Apri WhatsApp',
            type: 'button',
            action: () => {
              // Logic to open WhatsApp
            }
          },
          {
            id: 'appointment',
            label: 'Prenota appuntamento',
            type: 'button',
            action: () => {
              // Logic for appointment booking
            }
          },
          {
            id: 'home',
            label: 'Torna alla Home',
            type: 'button',
            action: () => {
              setGuideState(prev => ({ ...prev, isActive: false, currentStep: 0 }));
            }
          }
        ]
      }
    ];
  }, [settings, discounts, guideState.leadData, cart]);

  const startGuide = useCallback(() => {
    setGuideState(prev => ({
      ...prev,
      isActive: true,
      showChat: true,
      currentStep: 0,
      leadData: {}
    }));
  }, []);

  const stopGuide = useCallback(() => {
    setGuideState(prev => ({
      ...prev,
      isActive: false,
      showChat: false,
      currentStep: 0
    }));
  }, []);

  const nextStep = useCallback(() => {
    const steps = generateSteps();
    setGuideState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, steps.length - 1)
    }));
  }, [generateSteps]);

  const prevStep = useCallback(() => {
    setGuideState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0)
    }));
  }, []);

  const getCurrentStep = useCallback((): GuideStep | null => {
    const steps = generateSteps();
    return steps[guideState.currentStep] || null;
  }, [generateSteps, guideState.currentStep]);

  return {
    guideState,
    setGuideState,
    startGuide,
    stopGuide,
    nextStep,
    prevStep,
    getCurrentStep,
    generateSteps,
    settings,
    discounts
  };
}