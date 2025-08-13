import { useState, useCallback, useEffect } from 'react';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { GuideStep, LeadData, GuideState, AvatarType } from './types';
import type { Settings, Discounts, Item } from '@shared/schema';

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
        message: `Ciao! Sono Gennaro di ${studioName}, il tuo assistente virtuale per il matrimonio. Ho creato questo sistema intelligente per aiutarti a scegliere i servizi perfetti per il tuo grande giorno. Ti guiderò passo dopo passo, spiegandoti tutte le opzioni e gli sconti disponibili. Come ti chiami?`,
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
        avatar: 'enthusiastic',
        confetti: true,
        message: hasGlobalDiscount 
          ? `Fantastico ${guideState.leadData.name || 'amico'}! Hai scelto il momento perfetto! È attivo uno SCONTO GLOBALE del ${globalDiscount?.value}% su tutto il carrello, valido fino al ${globalDiscount?.endDate ? new Date(globalDiscount.endDate).toLocaleDateString('it-IT') : 'presto'}! Ma non finisce qui: ogni servizio e prodotto ha SCONTI AGGIUNTIVI (vedi i badge rossi) che si sommano a quello globale. Più selezioni, più risparmi!`
          : `Perfetto ${guideState.leadData.name || 'amico'}! Abbiamo preparato SCONTI SPECIALI su tutti i nostri servizi premium. Vedrai i badge rossi con le percentuali di sconto su ogni prodotto. Il sistema calcolerà automaticamente il tuo risparmio totale!`,
        actions: [{
          id: 'continue',
          label: 'Mostrami gli sconti!',
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
        avatar: 'explaining',
        message: `Ora ${guideState.leadData.name}, iniziamo con le informazioni fondamentali. Mi serve la data del matrimonio perché alcuni dei nostri servizi (come le Riprese Drone) dipendono dalla stagione e dalle condizioni meteo. Inoltre, questa data mi aiuterà a verificare la nostra disponibilità e a personalizzare la tua offerta.`,
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

      // Step 3: Service selection with detailed explanation
      {
        id: 'services',
        avatar: 'explaining',
        message: `Perfetto ${guideState.leadData.name}! Ora ti spiego come funziona il nostro sistema intelligente. Iniziamo dai SERVIZI (tab in alto). 
        
        🔑 REGOLA FONDAMENTALE: Il "Servizio Fotografico" è la CHIAVE che sblocca tutti i prodotti fotografici (album, foto invitati, ecc.). Senza di esso, vedrai molti prodotti "non disponibili".
        
        📹 Per i servizi video: Se scegli "Videomaker", si sbloccano automaticamente "Riprese Drone" e "Videoproiezione".
        
        💡 CONSIGLIO: Inizia sempre dal Servizio Fotografico, poi aggiungi video se interessato. Guarda a destra: vedrai le card cambiare da grigie a colorate!`,
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

      // Step 4: Products with gift rules explanation
      {
        id: 'products',
        avatar: 'enthusiastic',
        message: `Ottimo ${guideState.leadData.name}! Ora passiamo ai PRODOTTI. Qui ti aspettano delle SORPRESE INCREDIBILI! 
        
        🎁 REGALO ESCLUSIVO: Se selezioni TUTTI e 7 questi prodotti specifici insieme:
        • Album Genitori + Foto Invitati Classic + Riprese Drone + Servizio Fotografico + Videomaker + Videoproiezione + Foto per Invitati
        → Le "Foto per Invitati" diventano GRATIS! 
        
        🚫 ATTENZIONE: Gli album sono in mutua esclusione! Se scegli "Album 30x40" non puoi prendere "Album Piccolo" e viceversa.
        
        💰 Ogni prodotto ha il SUO sconto individuale che si somma al globale. Il sistema calcola tutto automaticamente!`,
        actions: [{
          id: 'continue_products',
          label: 'Scopri i Prodotti',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_products_tab'
      },

      // Step 5: Smart upsell with detailed benefits
      {
        id: 'upsell',
        avatar: 'enthusiastic',
        message: `${guideState.leadData.name}, ora ti faccio una proposta da VERO ESPERTO! Dopo 15 anni di matrimoni, questi sono i servizi che il 90% delle coppie rimpiange di non aver preso:
        
        🎬 VIDEOMAKER (€800): I ricordi più emozionanti sono in movimento! Le risate, le lacrime, le promesse... solo il video le cattura per sempre.
        
        🚁 RIPRESE DRONE (€300): Vue aeree mozzafiato della location, effetti cinematografici unici. Le tue foto su Instagram faranno invidia!
        
        📸 FOTO PER INVITATI (€200): Gli ospiti ricevono le foto direttamente, tu non devi pensare a nulla. Servizio premium che fa la differenza.
        
        💡 Se li prendi TUTTI e 3 insieme, si avvicinano al regalo delle "Foto per Invitati"! Che dici?`,
        actions: [
          {
            id: 'add_recommended',
            label: 'Aggiungi tutti e 3!',
            type: 'button',
            action: () => {
              // Logic to add recommended items
              setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
            }
          },
          {
            id: 'skip_recommended',
            label: 'Preferisco scegliere io',
            type: 'button',
            action: () => {
              setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
            }
          }
        ]
      },

      // Step 6: Detailed summary with breakdown
      {
        id: 'summary',
        avatar: 'explaining',
        message: hasGlobalDiscount 
          ? `Perfetto ${guideState.leadData.name}! Guarda il tuo carrello in basso: il sistema ha calcolato AUTOMATICAMENTE tutti i tuoi vantaggi:
          
          💚 SCONTO GLOBALE: ${globalDiscount?.value}% su tutto (scade il ${globalDiscount?.endDate ? new Date(globalDiscount.endDate).toLocaleDateString('it-IT') : 'presto'})
          💚 SCONTI PRODOTTO: Ogni servizio/prodotto ha il suo sconto specifico già applicato
          🎁 OMAGGI SBLOCCATI: Se hai selezionato tutto il pacchetto completo, vedi le "Foto per Invitati" GRATIS
          
          Il totale che vedi è quello FINALE, già con tutti gli sconti applicati. Trasparenza totale!`
          : `Eccellente ${guideState.leadData.name}! Il tuo carrello mostra il calcolo intelligente dei tuoi vantaggi:
          
          💚 SCONTI PRODOTTO: Ogni servizio/prodotto ha il suo sconto specifico già applicato  
          🎁 OMAGGI SBLOCCATI: Se hai completato il pacchetto, vedi gli omaggi attivati
          
          Il prezzo finale è già quello scontato. Nessuna sorpresa!`,
        actions: [{
          id: 'continue_summary',
          label: 'Vediamo i risparmi!',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_cart'
      },

      // Step 7: Celebrate savings with enthusiasm
      {
        id: 'savings',
        avatar: 'enthusiastic',
        confetti: true,
        message: `WOW ${guideState.leadData.name}! Hai fatto un AFFARE INCREDIBILE! 🎉
        
        💰 HAI RISPARMIATO: €${cart.getPricingWithRules().totalSavings} in totale!
        📊 BREAKDOWN DEI TUOI VANTAGGI:
        ${cart.getPricingWithRules().discount > 0 ? `• Sconto globale: €${cart.getPricingWithRules().discount}` : ''}
        ${cart.getPricingWithRules().giftSavings > 0 ? `• Omaggi sbloccati: €${cart.getPricingWithRules().giftSavings}` : ''}
        • Sconti prodotti individuali inclusi nel calcolo
        
        🎯 RISULTATO: Invece di pagare €${cart.getPricingWithRules().subtotal + cart.getPricingWithRules().totalSavings}, paghi solo €${cart.getPricingWithRules().total}!
        
        Sei pronto per finalizzare questa offerta speciale?`,
        actions: [{
          id: 'continue_checkout',
          label: 'SI! Finalizziamo!',
          type: 'button',
          action: () => {
            setGuideState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
          }
        }],
        uiHint: 'highlight_savings'
      },

      // Step 8: Lead collection with GDPR explanation
      {
        id: 'lead_collection',
        avatar: 'explaining',
        message: `Perfetto ${guideState.leadData.name}! Ora per completare il tuo preventivo personalizzato ho bisogno di alcuni dati. 
        
        📋 COSA TI INVIERÒ:
        • Preventivo dettagliato in PDF con tutti i servizi scelti
        • Riepilogo completo degli sconti applicati
        • Condizioni e modalità di pagamento
        • I miei contatti diretti per qualsiasi domanda
        
        🔒 PRIVACY: I tuoi dati sono protetti secondo il GDPR. Li uso SOLO per questo preventivo e per eventuali comunicazioni relative al matrimonio. Niente spam, promesso!
        
        Compila il form qui a destra e ti invio tutto immediatamente:`,
        actions: [], // Will be handled by a special lead form component
        uiHint: 'show_lead_form'
      },

      // Step 9: Warm closure with clear next steps
      {
        id: 'closure',
        avatar: 'smiling',
        message: `Fantastico ${guideState.leadData.name}! Il tuo preventivo è pronto e dovresti averlo ricevuto via email. 
        
        🎯 PROSSIMI PASSI:
        1. Scarica e leggi il PDF con calma
        2. Se hai domande, contattami direttamente
        3. Per confermare la prenotazione, basta un acconto del 30%
        
        💬 PARLIAMONE: Preferisci continuare la conversazione su WhatsApp (più veloce) o fissare una chiamata/videocall per approfondire i dettagli?
        
        📸 Come fotografo di matrimoni, sono qui per realizzare il racconto perfetto del vostro giorno più bello. Qualsiasi dubbio o personalizzazione, scrivetemi!`,
        actions: [
          {
            id: 'whatsapp',
            label: '💬 Apri WhatsApp',
            type: 'button',
            action: () => {
              // Logic to open WhatsApp
            }
          },
          {
            id: 'appointment',
            label: '📞 Prenota chiamata',
            type: 'button',
            action: () => {
              // Logic for appointment booking
            }
          },
          {
            id: 'home',
            label: '🏠 Torna alla Home classica',
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