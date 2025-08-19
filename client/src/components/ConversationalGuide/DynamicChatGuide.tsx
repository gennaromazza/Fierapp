import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ShoppingCart, Gift, Tag, Check, X, Sparkles, MessageCircle, ArrowLeft, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { collection, getDocs, query, where, onSnapshot, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Item, Discounts, Settings } from '../../../../shared/schema';
import CheckoutModal from '@/components/CheckoutModal';
import { LeadForm } from './LeadForm';
import type { LeadData } from './types';
import { SpectacularAvatar } from './SpectacularAvatar';
import { CalendarIcon } from 'lucide-react';
import { getItemDiscountInfo } from '../../lib/discounts';
import { calculateUnifiedPricing } from '../../lib/unifiedPricing';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/toast-notification';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type PhaseType = 'welcome' | 'collect_name' | 'collect_surname' | 'collect_email' | 'collect_phone' | 'collect_date' | 'services' | 'products' | 'summary' | 'lead';

interface ChatMessage {
  id: string;
  type: 'assistant' | 'user' | 'system';
  text?: string;
  avatar?: 'smiling' | 'explaining' | 'enthusiastic' | 'excited' | 'thoughtful';
  options?: Array<{
    id: string;
    label: string;
    value: string;
    action: () => void;
  }>;
  items?: Item[];
  showCart?: boolean;
  typing?: boolean;
  component?: 'service-selector' | 'product-selector' | 'date-selector';
}

export function DynamicChatGuide() {
  console.log('🚀 DynamicChatGuide component loaded');
  
  // Refs for setTimeout cleanup to prevent memory leaks
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  
  // Helper to create managed timeouts that auto-cleanup on unmount
  const createManagedTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeoutId = setTimeout(() => {
      timeoutsRef.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutsRef.current.add(timeoutId);
    return timeoutId;
  };
  
  // Clear all active timeouts
  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  };
  
  const cart = useCartWithRules();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [discounts, setDiscounts] = useState<Discounts | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Loading states for async data
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Use items from cart hook instead of loading separately
  const items = cart.getAllItemsWithAvailability() || [];
  const [itemsReady, setItemsReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('welcome');
  const [leadData, setLeadData] = useState<LeadData>({
    name: '',
    surname: '',
    email: '',
    phone: '',
    eventDate: ''
  });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [messageCounter, setMessageCounter] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [conversationData, setConversationData] = useState<{
    userName?: string;
    eventDate?: string;
    selectedServices: string[];
    selectedProducts: string[];
    preferences: string[];
    sessionId: string;
    startTime: Date;
  }>({
    selectedServices: [],
    selectedProducts: [],
    preferences: [],
    sessionId: `session_${Date.now()}`,
    startTime: new Date()
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up timeouts on component unmount');
      clearAllTimeouts();
    };
  }, []);

  // Utility function to remove invalid values recursively with robust error handling
  function removeUndefinedDeep(obj: any, removeNull: boolean = false): any {
    try {
      // Handle null and undefined early
      if (obj === null) return removeNull ? undefined : null;
      if (obj === undefined) return null;
      
      // Handle primitive invalid values
      if (Number.isNaN(obj)) return null;
      if (obj === Infinity || obj === -Infinity) return null;
      
      // Handle Date objects with validation
      if (obj instanceof Date) {
        try {
          return isNaN(obj.getTime()) ? null : obj;
        } catch (error) {
          console.warn('⚠️ Invalid Date object encountered:', obj, error);
          return null;
        }
      }
      
      // Handle Firebase serverTimestamp safely
      if (obj && typeof obj === 'object') {
        try {
          if (obj.constructor?.name === 'ServerTimestampFieldValueImpl' || obj._methodName === 'serverTimestamp') {
            return obj;
          }
        } catch (error) {
          console.warn('⚠️ Error checking Firebase timestamp:', error);
          // Continue processing as regular object
        }
      }
      
      // Handle Arrays with error recovery
      if (Array.isArray(obj)) {
        try {
          const cleanedArray = [];
          for (let i = 0; i < obj.length; i++) {
            try {
              const cleanedItem = removeUndefinedDeep(obj[i], removeNull);
              if (cleanedItem !== undefined && (!removeNull || cleanedItem !== null)) {
                cleanedArray.push(cleanedItem);
              }
            } catch (error) {
              console.warn(`⚠️ Error cleaning array item at index ${i}:`, error, obj[i]);
              // Skip problematic item and continue
            }
          }
          return cleanedArray;
        } catch (error) {
          console.error('❌ Critical error processing array:', error, obj);
          return []; // Return empty array as fallback
        }
      }
      
      // Handle Objects with error recovery
      if (typeof obj === 'object' && obj !== null) {
        try {
          const cleaned: any = {};
          const entries = Object.entries(obj);
          
          for (const [key, value] of entries) {
            try {
              const cleanedValue = removeUndefinedDeep(value, removeNull);
              if (cleanedValue !== undefined && (!removeNull || cleanedValue !== null)) {
                cleaned[key] = cleanedValue;
              }
            } catch (error) {
              console.warn(`⚠️ Error cleaning object property '${key}':`, error, value);
              // Skip problematic property and continue
            }
          }
          return cleaned;
        } catch (error) {
          console.error('❌ Critical error processing object:', error, obj);
          return {}; // Return empty object as fallback
        }
      }
      
      // Return valid primitives as-is
      return obj;
      
    } catch (error) {
      console.error('❌ Critical error in removeUndefinedDeep:', error, obj);
      // Final fallback - return null for any unrecoverable error
      return null;
    }
  }

  // Salva dati conversazione su Firebase
  const saveChatHistory = async (eventType: string, data: any = {}) => {
    try {
      const pricing = cart.getPricingWithRules();
      
      const rawData = {
        sessionId: conversationData.sessionId || `session_${Date.now()}`,
        eventType: eventType || 'unknown',
        data: data || {},
        conversationData: {
          userName: conversationData.userName || null,
          eventDate: conversationData.eventDate || null,
          selectedServices: conversationData.selectedServices || [],
          selectedProducts: conversationData.selectedProducts || [],
          preferences: conversationData.preferences || [],
          sessionId: conversationData.sessionId || `session_${Date.now()}`,
          startTime: conversationData.startTime || new Date(),
          currentPhase: currentPhase || 'unknown',
          messagesCount: messages?.length || 0,
          cartItemsCount: cart?.cart?.items?.length || 0,
          totalValue: pricing?.total || 0,
          totalSavings: pricing?.totalSavings || 0
        },
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      // Prima pulizia: rimuovi undefined, NaN, Infinity con gestione errori robusta
      let cleanedData;
      try {
        cleanedData = removeUndefinedDeep(rawData, false);
        console.log('✅ Data cleaning completed successfully');
      } catch (error) {
        console.error('❌ Critical error during data cleaning:', error);
        // Fallback: create minimal safe data structure
        cleanedData = {
          sessionId: conversationData.sessionId || `session_${Date.now()}`,
          eventType: eventType || 'unknown',
          data: { error: 'Data cleaning failed', originalError: (error as Error)?.message || 'Unknown error' },
          conversationData: {
            sessionId: conversationData.sessionId || `session_${Date.now()}`,
            currentPhase: currentPhase || 'unknown',
            messagesCount: messages?.length || 0,
            startTime: new Date()
          },
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString(),
          cleaningError: true
        };
        console.log('🚨 Using fallback data structure due to cleaning error');
      }

      // Log dettagliato PRIMA di salvare
      console.log('🔍 === FIREBASE SAVE DEBUG ===');
      console.log('📦 Raw data BEFORE cleaning:', rawData);
      console.log('🧹 Cleaned data AFTER cleaning:', cleanedData);
      
      // Serializza per verificare cosa verrà effettivamente salvato
      const jsonString = JSON.stringify(cleanedData, (key, value) => {
        if (value === undefined) return '[UNDEFINED]';
        if (Number.isNaN(value)) return '[NaN]';
        if (value === Infinity) return '[Infinity]';
        if (value === -Infinity) return '[-Infinity]';
        if (value && typeof value === 'object' && value.constructor?.name === 'ServerTimestampFieldValueImpl') {
          return '[ServerTimestamp]';
        }
        return value;
      }, 2);
      
      console.log('📤 JSON serializzato che verrà salvato:', jsonString);
      
      // Controllo finale per valori problematici
      const problematicValues = ['[UNDEFINED]', '[NaN]', '[Infinity]', '[-Infinity]'];
      const hasProblems = problematicValues.some(val => jsonString.includes(val));
      
      if (hasProblems) {
        console.error('❌ ERRORE: Trovati valori non validi nel JSON!');
        problematicValues.forEach(val => {
          if (jsonString.includes(val)) {
            const lines = jsonString.split('\n');
            lines.forEach((line, index) => {
              if (line.includes(val)) {
                console.error(`   Riga ${index + 1}: ${line.trim()}`);
              }
            });
          }
        });
        
        // Prova una seconda pulizia più aggressiva
        console.log('🔄 Tentativo di pulizia aggressiva...');
        const deepCleanedData = JSON.parse(JSON.stringify(cleanedData, (key, value) => {
          if (value === undefined || Number.isNaN(value) || value === Infinity || value === -Infinity) {
            return null;
          }
          return value;
        }));
        
        // Ripristina serverTimestamp dopo la serializzazione
        deepCleanedData.timestamp = serverTimestamp();
        
        console.log('✨ Dati dopo pulizia aggressiva:', deepCleanedData);
        await addDoc(collection(db, 'chat_history'), deepCleanedData);
      } else {
        console.log('✅ Nessun valore problematico trovato, procedo con il salvataggio');
        await addDoc(collection(db, 'chat_history'), cleanedData);
      }

      console.log(`💾 Chat history saved successfully: ${eventType}`, data);
    } catch (error: any) {
      console.error('❌ Error saving chat history:', error);
      console.error('📊 Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'N/A',
        stack: error?.stack || 'No stack trace'
      });
    }
  };

  // Reset completo per ogni nuova sessione
  useEffect(() => {
    if (!sessionStarted) {
      // Garantisce reset completo della chat
      setMessages([]);
      setCurrentPhase('welcome');
      setLeadData({});
      setUserInput('');
      setMessageCounter(0);
      setSessionStarted(true);

      // Reset carrello per nuova sessione
      cart.clearCart();

      console.log('🔄 Chat completamente resettata per nuova sessione');
    }
  }, [sessionStarted, cart]);

  // Track when items are ready
  useEffect(() => {
    if (!cart.rulesLoading && items.length > 0) {
      console.log('✅ Items are ready:', items.length);
      setItemsReady(true);
    }
  }, [cart.rulesLoading, items.length]);

  useEffect(() => {
    // Load global discounts and settings from Firebase
    async function loadData() {
      try {
        console.log('🔄 DynamicChatGuide - Loading settings and discounts...');
        setIsLoadingDiscounts(true);
        setIsLoadingSettings(true);
        setSettingsError(null);

        // Load discounts (both global and individual)
        const discountsDoc = await getDoc(doc(db, "settings", "discounts"));
        if (discountsDoc.exists()) {
          let discountsData = discountsDoc.data() as Discounts;

          // Process Firebase Timestamps to Date objects
          if (discountsData.global) {
            if (discountsData.global.startDate && typeof discountsData.global.startDate === 'object') {
              // Handle both Firebase Timestamp objects and timestamp objects with seconds/nanoseconds
              if ('toDate' in discountsData.global.startDate) {
                discountsData.global.startDate = (discountsData.global.startDate as any).toDate();
              } else if ('seconds' in discountsData.global.startDate) {
                const timestamp = discountsData.global.startDate as any;
                discountsData.global.startDate = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
              }
            }
            if (discountsData.global.endDate && typeof discountsData.global.endDate === 'object') {
              // Handle both Firebase Timestamp objects and timestamp objects with seconds/nanoseconds
              if ('toDate' in discountsData.global.endDate) {
                discountsData.global.endDate = (discountsData.global.endDate as any).toDate();
              } else if ('seconds' in discountsData.global.endDate) {
                const timestamp = discountsData.global.endDate as any;
                discountsData.global.endDate = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
              }
            }
          }

          // Process per-item overrides timestamps
          if (discountsData.perItemOverrides) {
            Object.keys(discountsData.perItemOverrides).forEach(key => {
              const itemDiscount = discountsData.perItemOverrides![key];
              if (itemDiscount.startDate && typeof itemDiscount.startDate === 'object') {
                if ('toDate' in itemDiscount.startDate) {
                  itemDiscount.startDate = (itemDiscount.startDate as any).toDate();
                } else if ('seconds' in itemDiscount.startDate) {
                  const timestamp = itemDiscount.startDate as any;
                  itemDiscount.startDate = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
                }
              }
              if (itemDiscount.endDate && typeof itemDiscount.endDate === 'object') {
                if ('toDate' in itemDiscount.endDate) {
                  itemDiscount.endDate = (itemDiscount.endDate as any).toDate();
                } else if ('seconds' in itemDiscount.endDate) {
                  const timestamp = itemDiscount.endDate as any;
                  itemDiscount.endDate = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
                }
              }
            });
          }

          setDiscounts(discountsData);
          console.log('✅ DynamicChatGuide - Discounts loaded successfully');
        }
        setIsLoadingDiscounts(false);

        // Load settings (studio name, branding, etc.)
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          const settingsData = settingsDoc.data() as Settings;
          setSettings(settingsData);
          console.log('✅ DynamicChatGuide - Settings loaded successfully');
        }
        setIsLoadingSettings(false);

      } catch (error) {
        console.error("❌ DynamicChatGuide - Error loading data:", error);
        setSettingsError(error instanceof Error ? error.message : 'Errore nel caricamento dei dati');
        setIsLoadingSettings(false);
        setIsLoadingDiscounts(false);
      }
    }

    loadData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-open checkout modal when lead phase is active and data is complete
  useEffect(() => {
    if (currentPhase === 'lead') {
      const isLeadDataComplete = leadData.name && leadData.surname && leadData.email && leadData.phone && leadData.eventDate;
      if (isLeadDataComplete) {
        setIsCheckoutOpen(true);
      }
    }
  }, [currentPhase, leadData]);

  // Show services when items become ready (if we're in services phase and showed loading)
  useEffect(() => {
    if (itemsReady && currentPhase === 'services' && messages.some(m => m.id === 'services-loading')) {
      console.log('✅ Items ready! Showing services...');

      const services = items.filter(item => {
        const isService = item.category === 'servizio';
        const isActive = item.active !== false;
        return isService && isActive;
      });

      // Remove loading message and add services
      setMessages(prev => prev.filter(m => m.id !== 'services-loading'));

      addMessage({
        id: 'services-selection',
        type: 'system',
        text: "Perfetto! Ecco i servizi disponibili:",
        items: services
      });
    }
  }, [itemsReady, currentPhase, messages, items]);

  // Initialize chat
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = settings?.studioName 
        ? `Ciao! 👋 Sono l'assistente di ${settings.studioName}! Ti guiderò nella scelta dei servizi e prodotti migliori con offerte esclusive per il tuo matrimonio perfetto.`
        : "Ciao! 👋 Sono il tuo assistente personale per il matrimonio perfetto! Ti guiderò nella scelta dei servizi e prodotti migliori con offerte esclusive.";

      addMessage({
        type: 'assistant',
        avatar: 'smiling',
        text: welcomeText,
      });

      createManagedTimeout(() => {
        addMessage({
          type: 'assistant',
          avatar: 'explaining',
          text: "Prima di iniziare, quando sarà il grande giorno?",
          options: [
            {
              id: 'date-2025',
              label: '📅 Nel 2025',
              value: '2025',
              action: () => handleDateSelection('2025')
            },
            {
              id: 'date-2026',
              label: '📅 Nel 2026',
              value: '2026',
              action: () => handleDateSelection('2026')
            },
            {
              id: 'date-later',
              label: '📅 Più avanti',
              value: 'later',
              action: () => handleDateSelection('later')
            }
          ]
        });
      }, 1500);
    }
  }, [messages.length, settings]);

  const addMessage = (message: Omit<ChatMessage, 'id'> & { id?: string }) => {
    const messageWithId = {
      ...message,
      id: message.id || `msg-${Date.now()}-${messageCounter}`
    };
    setMessageCounter(prev => prev + 1);

    if (message.typing) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { ...messageWithId, typing: false }]);
      }, 1000);
    } else {
      setMessages(prev => [...prev, messageWithId]);
    }
  };

  const handleDateSelection = (date: string) => {
    const dateText = date === '2025' ? 'Nel 2025' : date === '2026' ? 'Nel 2026' : 'Più avanti';

    addMessage({
      id: `user-date-${Date.now()}`,
      type: 'user',
      text: dateText
    });

    // Crea una data valida per Firebase - usa 1 gennaio dell'anno selezionato
    const validDate = date === '2025' || date === '2026' 
      ? `${date}-01-01` 
      : new Date().toISOString().split('T')[0];

    // Aggiorna dati conversazione
    setConversationData(prev => ({ ...prev, eventDate: validDate }));
    setLeadData((prev) => ({ 
      ...prev, 
      eventDate: validDate // ✅ Usa solo eventDate per coerenza con LeadForm
    }));

    console.log('📅 Data evento aggiornata:', { date, validDate, dateText });

    // Salva selezione data
    saveChatHistory('date_selected', { eventDate: validDate, dateText, originalSelection: date });

    // Start data collection phase
    createManagedTimeout(() => {
      addMessage({
        type: 'assistant',
        avatar: 'smiling',
        text: "Perfetto! Ora conosciamoci meglio. Come ti chiami? 😊"
      });
      setCurrentPhase('collect_name');
    }, 1000);
  };

  // Gestione input utente per raccolta dati progressiva
  const handleUserInput = (input: string) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    switch (currentPhase) {
      case 'collect_name':
        handleNameInput(trimmedInput);
        break;
      case 'collect_surname':
        handleSurnameInput(trimmedInput);
        break;
      case 'collect_email':
        handleEmailInput(trimmedInput);
        break;
      case 'collect_phone':
        handlePhoneInput(trimmedInput);
        break;
      case 'collect_date':
        // Non gestiamo input testuale per la data, usiamo solo il date picker
        break;
      default:
        // Altri input non gestiti in questa fase
        break;
    }
    setUserInput('');
  };

  const handleNameInput = (name: string) => {
    addMessage({
      type: 'user',
      text: name
    });

    setLeadData((prev) => {
      const newData = { ...prev, name };
      console.log('📝 DynamicChatGuide - Nome aggiornato:', newData);
      return newData;
    });

    setTimeout(() => {
      addMessage({
        type: 'assistant',
        avatar: 'smiling',
        text: `Piacere di conoscerti, ${name}! 👋 E il tuo cognome?`
      });
      setCurrentPhase('collect_surname');
    }, 800);
  };

  const handleSurnameInput = (surname: string) => {
    addMessage({
      type: 'user',
      text: surname
    });

    setLeadData((prev) => {
      const newData = { ...prev, surname };
      console.log('📝 DynamicChatGuide - Cognome aggiornato:', newData);
      return newData;
    });

    setTimeout(() => {
      addMessage({
        type: 'assistant',
        avatar: 'explaining',
        text: `${leadData.name} ${surname}, per inviarti il preventivo personalizzato in PDF, qual è la tua email? 📧`
      });
      setCurrentPhase('collect_email');
    }, 800);
  };

  const handleEmailInput = (email: string) => {
    // Comprehensive email validation with detailed error messages
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const trimmedEmail = email.trim();
    
    // Check for empty email
    if (!trimmedEmail) {
      addMessage({
        type: 'assistant',
        avatar: 'thoughtful',
        text: 'Non hai inserito nessuna email. Inserisci il tuo indirizzo email per ricevere il preventivo! 📧'
      });
      return;
    }
    
    // Check basic format requirements
    if (!trimmedEmail.includes('@')) {
      addMessage({
        type: 'assistant',
        avatar: 'thoughtful',
        text: 'L\'email deve contenere il simbolo @. Esempio: nome@dominio.com 😊'
      });
      return;
    }
    
    // Check for domain part
    if (!trimmedEmail.includes('.') || trimmedEmail.endsWith('.')) {
      addMessage({
        type: 'assistant',
        avatar: 'thoughtful',
        text: 'L\'email deve avere un dominio valido. Esempio: mario@gmail.com 📧'
      });
      return;
    }
    
    // Comprehensive regex validation
    if (!emailRegex.test(trimmedEmail)) {
      // Specific error messages for common issues
      if (trimmedEmail.startsWith('@') || trimmedEmail.startsWith('.')) {
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: 'L\'email non può iniziare con @ o punto. Prova con: nome@dominio.com 😊'
        });
      } else if (trimmedEmail.endsWith('@')) {
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: 'L\'email è incompleta. Manca il dominio dopo @. Esempio: mario@gmail.com 📧'
        });
      } else if (trimmedEmail.includes('..')) {
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: 'L\'email non può contenere punti consecutivi. Controlla e riprova! 😊'
        });
      } else if (trimmedEmail.includes(' ')) {
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: 'L\'email non può contenere spazi. Rimuovi gli spazi e riprova! 📧'
        });
      } else {
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: 'Il formato email non è valido. Usa il formato: nome@dominio.com 😊'
        });
      }
      return;
    }

    addMessage({
      type: 'user',
      text: trimmedEmail
    });

    setLeadData((prev) => {
      const newData = { ...prev, email: trimmedEmail };
      console.log('📝 DynamicChatGuide - Email aggiornata:', newData);
      return newData;
    });

    setTimeout(() => {
      addMessage({
        type: 'assistant',
        avatar: 'enthusiastic',
        text: 'Perfetto! E il tuo numero di telefono per WhatsApp? Così potremo coordinarci meglio! 📱'
      });
      setCurrentPhase('collect_phone');
    }, 800);
  };

  const handlePhoneInput = (phone: string) => {
    addMessage({
      type: 'user',
      text: phone
    });

    setLeadData((prev) => {
      const newData = { ...prev, phone };
      console.log('📝 DynamicChatGuide - Telefono aggiornato:', newData);
      return newData;
    });

    setTimeout(() => {
      addMessage({
        type: 'assistant',
        avatar: 'explaining',
        text: 'Infine, quando è previsto il tuo matrimonio? 💒',
        component: 'date-selector'
      });
      setCurrentPhase('collect_date');
    }, 800);
  };

  const handleSpecificDateSelection = (selectedDate: Date) => {
    const dateText = selectedDate.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    addMessage({
      type: 'user', 
      text: dateText
    });

    setLeadData((prev) => {
      const newData = { ...prev, eventDate: selectedDate.toISOString().split('T')[0] };
      console.log('📝 DynamicChatGuide - Data evento aggiornata:', newData);
      return newData;
    });

    createManagedTimeout(() => {
      const studioPersonalizedText = settings?.studioName ? 
        `Fantastico, ${leadData.name}! ${settings.studioName} ha tutto quello che serve per il tuo matrimonio da sogno! 🎉` :
        `Fantastico, ${leadData.name}! Abbiamo tutto quello che serve per il tuo matrimonio da sogno! 🎉`;

      const contactInfo = [];
      if (settings?.phoneNumber) contactInfo.push(`📞 ${settings.phoneNumber}`);
      if (settings?.email) contactInfo.push(`📧 ${settings.email}`);
      if (settings?.studioAddress) contactInfo.push(`📍 ${settings.studioAddress}`);

      const contactText = contactInfo.length > 0 ? 
        `\n\nPer info dirette:\n${contactInfo.join('\n')}` : '';

      const hasGlobalDiscount = discounts?.global?.isActive;
      const discountText = hasGlobalDiscount && discounts?.global ? 
        `\n\n🎯 OFFERTA SPECIALE: Sconto ${discounts.global.type === 'percent' ? discounts.global.value + '%' : '€' + discounts.global.value} attivo su tutti i servizi!` : '';

      addMessage({
        type: 'assistant',
        avatar: 'excited',
        text: `${studioPersonalizedText}${discountText}${contactText}`,
        typing: true
      });

      startServicesPhase();
    }, 1200);
  };

  const startServicesPhase = () => {
    setCurrentPhase('services');

    // Salva transizione di fase
    saveChatHistory('phase_started', { phase: 'services', timestamp: new Date() });

    addMessage({
      type: 'assistant',
      avatar: 'enthusiastic',
      text: "Perfetto! Iniziamo con i SERVIZI FONDAMENTALI 🎬📸\n\n💡 SUGGERIMENTO: Scegliendo entrambi i servizi (Foto + Video) sbloccherai prodotti esclusivi e otterrai il massimo risparmio!",
      typing: true
    });

    // Attendi 2 secondi poi controlla se gli items sono pronti
    createManagedTimeout(() => {
      if (!itemsReady) {
        console.log('⏳ Items not ready yet, showing loading message...');
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: "Sto caricando i servizi disponibili... un momento per favore! ⏳",
        });
        return;
      }

      const services = items.filter(item => {
        const isService = item.category === 'servizio';
        const isActive = item.active !== false;
        console.log('🔍 Service check - Item:', item.title, 'Category:', item.category, 'active:', item.active, 'isService:', isService);
        return isService && isActive;
      });

      console.log('🔍 Filtered services:', services);

      addMessage({
        type: 'system',
        text: "Seleziona i servizi che desideri:",
        items: services
      });
    }, 2000);
  };

  const handleItemToggle = (item: Item) => {
    const isSelected = cart.cart.items.some(cartItem => cartItem.id === item.id);

    if (isSelected) {
      cart.removeItem(item.id);
      toast.toast({
        title: "❌ Rimosso",
        description: `${item.title} rimosso dal carrello`,
        variant: "destructive",
        duration: 2000,
      });

      // Aggiorna dati conversazione rimuovendo item
      setConversationData(prev => ({
        ...prev,
        selectedServices: item.category === 'servizio' 
          ? prev.selectedServices.filter(id => id !== item.id)
          : prev.selectedServices,
        selectedProducts: item.category === 'prodotto'
          ? prev.selectedProducts.filter(id => id !== item.id)
          : prev.selectedProducts
      }));

      // Salva rimozione item
      saveChatHistory('item_removed', { 
        itemId: item.id, 
        itemTitle: item.title, 
        category: item.category,
        phase: currentPhase 
      });

    } else {
      // Controlla se posso aggiungere l'item (regole di disponibilità)
      const isAvailable = cart.isItemAvailable(item.id);

      if (!isAvailable) {
        const reason = cart.getUnavailableReason(item.id);
        addMessage({
          type: 'assistant',
          avatar: 'thoughtful',
          text: `⚠️ ${item.title} non è disponibile: ${reason}`,
          typing: true
        });
        return;
      }

      const success = cart.addItem({
        id: item.id,
        title: item.title,
        price: item.price,
        category: item.category
      });

      if (success) {
        const isGift = cart.isItemGift(item.id);

        // Toast normali per prodotti, figo solo per regali
        if (isGift) {
          toast.gift("🎁 Regalo Sbloccato!", `${item.title} è ora GRATUITO!`, 4000);
        } else {
          toast.success("✅ Aggiunto", `${item.title} aggiunto al carrello`, 2000);
        }

        // Aggiorna dati conversazione aggiungendo item
        setConversationData(prev => ({
          ...prev,
          selectedServices: item.category === 'servizio' && !prev.selectedServices.includes(item.id)
            ? [...prev.selectedServices, item.id]
            : prev.selectedServices,
          selectedProducts: item.category === 'prodotto' && !prev.selectedProducts.includes(item.id)
            ? [...prev.selectedProducts, item.id]
            : prev.selectedProducts
        }));

        // Salva aggiunta item con dettagli di pricing
        const pricing = cart.getPricingWithRules();
        saveChatHistory('item_added', { 
          itemId: item.id, 
          itemTitle: item.title, 
          category: item.category,
          price: item.price,
          isGift,
          phase: currentPhase,
          cartTotal: pricing.total,
          cartSavings: pricing.totalSavings
        });

        // Controllo per feedback intelligente sui regali sbloccati
        setTimeout(() => {
          checkForNewGifts();
        }, 500);
      }
    }

    // Check if should move to next phase
    if (currentPhase === 'services') {
      const selectedServices = cart.cart.items.filter(i => i.category === 'servizio');
      if (selectedServices.length > 0) {
        setTimeout(() => {
          addMessage({
            type: 'assistant',
            avatar: 'excited',
            text: "Ottima scelta! Vuoi procedere con i prodotti aggiuntivi?",
            options: [
              {
                id: 'continue-products',
                label: '➡️ Continua con i prodotti',
                value: 'continue',
                action: () => startProductsPhase()
              }
            ]
          });
        }, 1000);
      }
    }
  };

  // Controlla se ci sono nuovi regali attivati e mostra feedback
  const checkForNewGifts = () => {
    const availableGifts = items.filter(item => 
      cart.isItemGift(item.id) && 
      !cart.cart.items.find(ci => ci.id === item.id)
    );

    if (availableGifts.length > 0) {
      const giftNames = availableGifts.map(item => item.title).join(', ');

      addMessage({
        type: 'assistant',
        avatar: 'enthusiastic',
        text: `🎉 FANTASTICO! Hai sbloccato dei REGALI!\n\n🎁 Ora ${giftNames} ${availableGifts.length === 1 ? 'è' : 'sono'} GRATUITO!\n\nPuoi aggiungerlo al tuo carrello senza costi aggiuntivi! ✨`,
        typing: true
      });
    }
  };

  const startProductsPhase = () => {
    setCurrentPhase('products');

    // Salva transizione di fase con stato servizi selezionati
    const selectedServices = cart.cart.items.filter(i => i.category === 'servizio');
    saveChatHistory('phase_started', { 
      phase: 'products', 
      timestamp: new Date(),
      selectedServicesCount: selectedServices.length,
      selectedServices: selectedServices.map(s => ({ id: s.id, title: s.title }))
    });

    const hasPhotoService = cart.cart.items.some(i => i.id === 'bsCHxhOyCn70gtzBAGQQ');
    const hasVideoService = cart.cart.items.some(i => i.id === 'wFwLZdWcjo6tdkhasQbs');

    // Analizza quali prodotti sono disponibili tramite le regole
    const products = items.filter(item => item.category === 'prodotto');
    const availableProducts = products.filter(item => cart.isItemAvailable(item.id));
    const giftProducts = products.filter(item => cart.isItemGift(item.id));

    let unlockMessage = "Ora vediamo i PRODOTTI AGGIUNTIVI! 🎁\n\n";

    if (hasPhotoService && hasVideoService) {
      unlockMessage += "🎉 FANTASTICO! Hai scelto entrambi i servizi!\n";
      unlockMessage += `✨ Hai sbloccato ${availableProducts.length} prodotti esclusivi\n`;
      if (giftProducts.length > 0) {
        const giftNames = giftProducts.map(item => item.title).join(', ');
        unlockMessage += `🎁 Regalo per te: ${giftNames}!`;
      }
    } else if (hasPhotoService) {
      unlockMessage += "📸 Con il servizio fotografico hai sbloccato gli album fotografici!";
      const unavailableCount = products.length - availableProducts.length;
      if (unavailableCount > 0) {
        unlockMessage += `\n💡 Aggiungi il servizio video per sbloccare altri ${unavailableCount} prodotti!`;
      }
    } else if (hasVideoService) {
      unlockMessage += "🎬 Con il servizio video hai sbloccato Drone e VideoProiezione!";
      const unavailableCount = products.length - availableProducts.length;
      if (unavailableCount > 0) {
        unlockMessage += `\n💡 Aggiungi il servizio fotografico per sbloccare altri ${unavailableCount} prodotti!`;
      }
    } else {
      unlockMessage += "🔒 Scegli almeno un servizio per sbloccare i prodotti esclusivi!";
    }

    addMessage({
      type: 'assistant',
      avatar: 'enthusiastic',
      text: unlockMessage,
      typing: true
    });

    createManagedTimeout(() => {
      addMessage({
        type: 'system',
        text: availableProducts.length > 0 ? "Scegli i prodotti che desideri:" : "Seleziona prima un servizio per vedere i prodotti:",
        items: products
      });
    }, 2000);
  };

  const startSummaryPhase = () => {
    setCurrentPhase('summary');

    const pricing = cart.getPricingWithRules();
    const giftItems = cart.getItemsWithRuleInfo().filter(item => item.isGift);
    const giftItemIds = giftItems.map(item => item.id);

    // Salva transizione a summary con dettagli completi carrello
    const selectedItems = cart.cart.items.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      price: item.price
    }));

    saveChatHistory('phase_started', { 
      phase: 'summary', 
      timestamp: new Date(),
      cartTotal: pricing.total,
      cartSavings: pricing.totalSavings,
      itemsCount: cart.cart.items.length,
      selectedItems,
      giftItemsCount: giftItems.length,
      giftItems: giftItems.map(item => ({ id: item.id, title: item.title }))
    });

    // Calculate comprehensive savings using unified pricing system
    const savingsInfo = discounts ? 
      calculateUnifiedPricing(cart.cart.items, discounts, giftItemIds) :
      {
        subtotal: pricing.total,
        originalSubtotal: pricing.total,
        globalDiscountSavings: 0,
        individualDiscountSavings: 0,
        totalDiscountSavings: 0,
        giftSavings: pricing.giftSavings,
        finalTotal: pricing.total,
        totalSavings: pricing.giftSavings,
        itemDetails: []
      };

    const studioText = settings?.studioName ? ` da ${settings.studioName}` : '';
    let summaryText = `🎉 ECCELLENTE! Ecco il tuo preventivo personalizzato${studioText}:\n\n`;

    if (savingsInfo.totalDiscountSavings > 0 || savingsInfo.giftSavings > 0) {
      summaryText += `💰 Prezzo originale: €${savingsInfo.originalSubtotal}\n`;

      if (savingsInfo.globalDiscountSavings > 0) {
        const globalDiscount = discounts?.global;
        const discountText = globalDiscount?.type === 'percent' ? 
          `${globalDiscount.value}%` : `€${globalDiscount?.value}`;
        summaryText += `💸 Sconto globale (${discountText}): -€${savingsInfo.globalDiscountSavings}\n`;
      }

      if (savingsInfo.individualDiscountSavings > 0) {
        summaryText += `🎯 Sconti speciali prodotti: -€${savingsInfo.individualDiscountSavings}\n`;
      }

      if (savingsInfo.giftSavings > 0) {
        summaryText += `🎁 Risparmi con regali: €${savingsInfo.giftSavings}\n`;
      }

      summaryText += `💰 Totale finale: €${savingsInfo.finalTotal}\n`;
      summaryText += `✨ RISPARMI TOTALI: €${savingsInfo.totalSavings} 💫\n`;
    } else {
      summaryText += `💰 Totale: €${savingsInfo.finalTotal}\n`;
    }

    if (giftItems.length > 0) {
      const giftNames = giftItems.map(item => item.title).join(', ');
      summaryText += `\n🎁 Prodotti GRATUITI: ${giftNames}`;
    }

    summaryText += "\n\nVuoi procedere con la prenotazione?";

    addMessage({
      type: 'assistant',
      avatar: 'excited',
      text: summaryText,
      showCart: true,
      typing: true
    });

    setTimeout(() => {
      const contactText = settings?.studioName ? 
        "Compila i tuoi dati per ricevere il preventivo dettagliato di " + settings.studioName + ":" :
        "Compila i tuoi dati per ricevere il preventivo dettagliato:";

      addMessage({
        type: 'assistant',
        avatar: 'smiling',
        text: contactText,
        options: [
          {
            id: 'proceed-checkout',
            label: '📝 Inserisci i tuoi dati',
            value: 'checkout',
            action: () => {
              if (currentPhase !== 'lead') {
                console.log('🔄 Transitioning to lead phase from summary options');
                saveChatHistory('phase_started', { 
                  phase: 'lead', 
                  timestamp: new Date(),
                  finalCartTotal: cart.getPricingWithRules().total,
                  finalCartSavings: cart.getPricingWithRules().totalSavings,
                  readyForCheckout: true
                });
                setCurrentPhase('lead');
              }
            }
          }
        ]
      });
    }, 2000);
  };

  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const getDetailedUnavailableReason = (item: Item): string => {
    if (cart.isItemAvailable(item.id)) return '';

    // Check for mutual exclusion rules first
    const selectedItems = cart.cart.items;
    const rules = cart.getApplicableRules();

    for (const rule of rules) {
      if (rule.type === 'availability' && 
          rule.action === 'disable' && 
          rule.targetItems.includes(item.id) &&
          rule.conditions.type === 'mutually_exclusive') {

        const conflictingWith = rule.conditions.mutuallyExclusiveWith;
        const conflictingItemIds = Array.isArray(conflictingWith) ? conflictingWith : [conflictingWith];
        const conflictingItem = selectedItems.find(si => conflictingItemIds.some(id => id === si.id));

        if (conflictingItem) {
          return `Questo prodotto non è disponibile perché hai già scelto "${conflictingItem.title}". I due prodotti sono alternativi tra loro.`;
        }
      }
    }

    // Check for required items rules
    for (const rule of rules) {
      if (rule.type === 'availability' && 
          rule.action === 'disable' && 
          rule.targetItems.includes(item.id) &&
          rule.conditions.type === 'required_items') {

        const requiredItems = rule.conditions.requiredItems || [];
        const selectedItemIds = selectedItems.map(si => si.id);
        const missingItems = requiredItems.filter(reqId => !selectedItemIds.includes(reqId));

        if (missingItems.length > 0) {
          // Get item names for missing items
          const allItems = cart.getAllItemsWithAvailability();
          const missingItemNames = missingItems.map(id => {
            const foundItem = allItems.find(i => i.id === id);
            return foundItem ? foundItem.title : 'Servizio richiesto';
          });

          if (missingItemNames.length === 1) {
            return `Per sbloccare questo prodotto devi prima selezionare: ${missingItemNames[0]}`;
          } else {
            return `Per sbloccare questo prodotto devi prima selezionare: ${missingItemNames.join(', ')}`;
          }
        }
      }
    }

    // Fallback to generic reason
    return cart.getUnavailableReason(item.id) || 'Elemento non disponibile';
  };

  const toggleDescription = useCallback((itemId: string) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }, []);

  const renderItemCard = useCallback((item: Item) => {
    const cartItem = cart.cart.items.find(ci => ci.id === item.id);
    const isSelected = !!cartItem;
    const isAvailable = cart.isItemAvailable(item.id);
    const isGift = cart.isItemGift(item.id);
    const giftSettings = cart.getItemGiftSettings(item.id);
    const unavailableReason = !isAvailable ? getDetailedUnavailableReason(item) : null;
    const isUnavailable = !isAvailable;
    const isDescriptionExpanded = expandedDescriptions[item.id] || false;

    // Calculate discounted price using both global and individual discounts
    const originalPrice = item.originalPrice || item.price;

    let discountInfo: {
      finalPrice: number;
      savings: number;
      discountType: 'individual' | 'global' | null;
      discountValue: number;
    } = { finalPrice: originalPrice, discountType: null, discountValue: 0, savings: 0 };

    if (discounts && !isGift) {
      discountInfo = getItemDiscountInfo(originalPrice, item.id, discounts);
    }

    const hasDiscount = discountInfo.discountType !== null;

    const finalPrice = isGift ? 0 : discountInfo.finalPrice;

    return (
      <div
        key={item.id}
        className={cn(
          "border rounded-lg p-3 mb-2 transition-all cursor-pointer",
          isSelected 
            ? "border-blue-500 bg-blue-50" 
            : isUnavailable
              ? "border-gray-200 bg-gray-50 opacity-60"
              : "border-gray-200 hover:border-gray-300 hover:shadow-md",
          isUnavailable && "cursor-not-allowed"
        )}
        onClick={() => !isUnavailable && handleItemToggle(item)}
      >
        <div className="flex items-start gap-3">
          {/* Product Image */}
          {item.imageUrl && (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              <img 
                src={item.imageUrl} 
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={cn(
                "font-medium text-sm",
                isUnavailable ? "text-gray-400" : "text-gray-900"
              )}>
                {item.title}
              </h4>
              {isSelected && <Check className="h-4 w-4 text-blue-600" />}
              {isGift && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                  GRATIS
                </Badge>
              )}
            </div>

            {/* Description with expand/collapse */}
            {item.description && (
              <div className="mt-1">
                <p className={cn(
                  "text-xs",
                  isUnavailable ? "text-gray-400" : "text-gray-600"
                )}>
                  {isDescriptionExpanded 
                    ? item.description 
                    : `${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}`
                  }
                </p>
                {item.description.length > 50 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDescription(item.id);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1 font-medium"
                  >
                    {isDescriptionExpanded ? 'Mostra meno' : 'Continua a leggere'}
                  </button>
                )}
              </div>
            )}

            {/* Enhanced unavailable reason */}
            {unavailableReason && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                <div className="flex items-start gap-1">
                  <X className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 leading-relaxed">
                    {unavailableReason}
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* Enhanced Pricing Display with Visual Feedback */}
          <div className="text-right ml-2 flex flex-col items-end">
            {isGift ? (
              <div className="flex flex-col items-end">
                <div className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                  GRATIS
                </div>
                <div className="text-xs text-gray-500 line-through mt-1">€{item.price}</div>
                {giftSettings?.giftText && (
                  <div className="text-xs text-green-600 font-medium mt-1">
                    {giftSettings.giftText}
                  </div>
                )}
              </div>
            ) : hasDiscount ? (
              <div className="flex flex-col items-end">
                <div className="text-xs text-gray-400 line-through">
                  €{originalPrice}
                </div>
                <div className="text-sm font-semibold text-green-600 bg-gradient-to-r from-green-50 to-emerald-50 px-2 py-1 rounded-md border border-green-200">
                  €{finalPrice}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="text-xs text-green-600 font-medium">
                    -{Math.round((discountInfo.savings / originalPrice) * 100)}%
                  </div>
                  {discountInfo.discountType === 'individual' ? (
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                      Speciale
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                      Globale
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-green-600 font-medium">
                  Risparmi €{discountInfo.savings.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className={cn(
                "text-sm font-medium",
                isUnavailable ? "text-gray-400" : "text-gray-900"
              )}>
                €{originalPrice}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [cart, discounts, expandedDescriptions, getDetailedUnavailableReason, handleItemToggle, toggleDescription]);

  const renderMessage = (message: ChatMessage) => {
    if (message.type === 'assistant') {
      return (
        <div className="flex gap-3 mb-4">
          <SpectacularAvatar 
            type={message.avatar || 'smiling'}
            className="flex-shrink-0 w-10 h-10"
          />
          <div className="flex-1">
            <div className="bg-gray-100 rounded-lg p-4 max-w-lg">
              {message.text && (
                <p className="text-gray-800 whitespace-pre-line">{message.text}</p>
              )}

              {message.options && (
                <div className="mt-3 space-y-2">
                  {message.options.map(option => (
                    <Button
                      key={option.id}
                      onClick={option.action}
                      variant="outline"
                      className="w-full justify-start text-left"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}

              {message.component === 'date-selector' && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-medium mb-3">Seleziona una data specifica:</p>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                    <input
                      type="date"
                      value={leadData.eventDate ? new Date(leadData.eventDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const selectedDate = new Date(e.target.value);
                          handleSpecificDateSelection(selectedDate);
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Seleziona data matrimonio"
                    />
                  </div>
                </div>
              )}

              {message.showCart && cart.cart.items.length > 0 && (() => {
                // Calculate savings for cart total display
                const pricing = cart.getPricingWithRules();
                const giftItems = cart.getItemsWithRuleInfo().filter(item => item.isGift);
                const giftItemIds = giftItems.map(item => item.id);
                const cartSavingsInfo = discounts ? 
                  calculateUnifiedPricing(cart.cart.items, discounts, giftItemIds) :
                  { finalTotal: pricing.total, originalSubtotal: pricing.total };

                return (
                  <div className="mt-4 p-3 bg-white rounded-lg border">
                    <h4 className="font-semibold mb-2 text-sm">Riepilogo Ordine:</h4>
                    {cart.cart.items.map(item => {
                      // Calculate discount for this item
                      const originalPrice = item.originalPrice || item.price;
                      const discountInfo = discounts ? 
                        getItemDiscountInfo(originalPrice, item.id, discounts) : 
                        { finalPrice: originalPrice, discountType: null, discountValue: 0, savings: 0 };
                      const isGift = cart.isItemGift(item.id);
                      const finalPrice = isGift ? 0 : discountInfo.finalPrice;
                      const hasDiscount = discountInfo.discountType !== null && !isGift;

                      return (
                        <div key={item.id} className="flex justify-between text-xs mb-1">
                          <span className={isGift ? "text-green-600" : ""}>
                            {item.title} {isGift && "(OMAGGIO)"}
                          </span>
                          <div className="flex items-center gap-2">
                            {(hasDiscount || isGift) && (
                              <span className="line-through text-gray-400 text-xs">
                                €{originalPrice}
                              </span>
                            )}
                            <span className={finalPrice === 0 ? "text-green-600 font-bold" : (hasDiscount ? "text-green-600 font-semibold" : "")}>
                              {finalPrice === 0 ? "GRATIS" : `€${finalPrice}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="border-t mt-2 pt-2">
                      <div className="flex justify-between font-bold">
                        <span>Totale:</span>
                        <span className="text-green-600">
                          €{Math.round(cartSavingsInfo.finalTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      );
    } else if (message.type === 'user') {
      return (
        <div className="flex justify-end mb-4">
          <div className="bg-blue-600 text-white rounded-lg p-3 max-w-lg">
            <p className="text-sm">{message.text}</p>
          </div>
        </div>
      );
    } else if (message.type === 'system' && message.items) {
      return (
        <div className="mb-4">
          <div className="bg-gray-50 rounded-lg p-4 border">
            {message.text && (
              <h4 className="text-sm font-semibold text-gray-800 mb-3">{message.text}</h4>
            )}
            <div className="space-y-3">
              {message.items.length > 0 ? (
                message.items.map(item => renderItemCard(item))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessun elemento disponibile
                </p>
              )}
            </div>
            {currentPhase === 'products' && (
              <Button
                onClick={startSummaryPhase}
                className="w-full mt-4 bg-green-600 hover:bg-green-700"
              >
                ✅ Procedi al Riepilogo
              </Button>
            )}
            {currentPhase === 'services' && cart.cart.items.some(i => i.category === 'servizio') && (
              <Button
                onClick={() => startProductsPhase()}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              >
                ➡️ Continua con i prodotti
              </Button>
            )}
          </div>
        </div>
      );
    }

    return null; // Should not happen if currentPhase is handled
  };

  // Dynamically render content based on current phase
  const renderContent = () => {
    // Filter items for main services and categories
    const allServices = items.filter(item => item.category === 'servizio' && item.active !== false);
    const mainServices = allServices.filter(item => item.tags?.includes('main'));
    const serviceCategories = [
      { key: 'photo-services', title: 'Servizi Fotografici', icon: '📸', items: allServices.filter(item => item.tags?.includes('photo')) },
      { key: 'video-services', title: 'Servizi Video', icon: '🎬', items: allServices.filter(item => item.tags?.includes('video')) },
      { key: 'other-services', title: 'Altri Servizi', icon: '✨', items: allServices.filter(item => !item.tags || (!item.tags.includes('photo') && !item.tags.includes('video') && !item.tags.includes('main'))) }
    ].filter(cat => cat.items.length > 0);

    if (currentPhase === 'welcome') {
      return (
        <div key="welcome-step" className="space-y-4 text-center">
          <SpectacularAvatar type="explaining" className="mx-auto w-24 h-24 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Benvenuto/a!
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Sono qui per aiutarti a creare il pacchetto perfetto per il tuo matrimonio.
          </p>
          <p className="text-lg text-gray-600 mb-6">
            Per iniziare, quando sarà il grande giorno?
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button onClick={() => handleDateSelection('2025')} className="w-64 py-3 text-lg">📅 2025</Button>
            <Button onClick={() => handleDateSelection('2026')} className="w-64 py-3 text-lg">📅 2026</Button>
            <Button onClick={() => handleDateSelection('later')} className="w-64 py-3 text-lg">📅 Più avanti</Button>
          </div>
        </div>
      );
    }

    if (currentPhase === 'collect_name') {
      return (
        <div key="collect-name-step" className="space-y-4">
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                Perfetto! Ora conosciamoci meglio. Come ti chiami? 😊
              </p>
            </div>
          </div>
          {/* Input is handled in the input area */}
        </div>
      );
    }
    if (currentPhase === 'collect_surname') {
      return (
        <div key="collect-surname-step" className="space-y-4">
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                {leadData.name} {leadData.surname}, per inviarti il preventivo personalizzato in PDF, qual è la tua email? 📧
              </p>
            </div>
          </div>
        </div>
      );
    }
    if (currentPhase === 'collect_email') {
      return (
        <div key="collect-email-step" className="space-y-4">
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                Perfetto! E il tuo numero di telefono per WhatsApp? Così potremo coordinarci meglio! 📱
              </p>
            </div>
          </div>
        </div>
      );
    }
    if (currentPhase === 'collect_phone') {
      return (
        <div key="collect-phone-step" className="space-y-4">
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                Infine, quando è previsto il tuo matrimonio? 💒
              </p>
            </div>
          </div>
        </div>
      );
    }
    if (currentPhase === 'lead') {
      // Log the data being passed to form
      console.log('🎯 DynamicChatGuide - Entering lead phase with data:', {
        name: leadData.name,
        surname: leadData.surname,
        email: leadData.email,
        phone: leadData.phone,
        eventDate: leadData.eventDate
      });
      
      return (
        <div key="lead-step" className="space-y-4">
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                Fantastico! Il tuo pacchetto è pronto. 
                Inserisci i tuoi dati per ricevere il preventivo dettagliato! 📋
              </p>
            </div>
          </div>

          {/* ✅ Pass collected data to LeadForm */}
          <LeadForm
            key="stable-lead-form"
            initialData={{
              name: leadData.name || '',
              surname: leadData.surname || '',
              email: leadData.email || '',
              phone: leadData.phone || '',
              eventDate: leadData.eventDate || '',
              notes: leadData.notes || '',
              gdprAccepted: !!leadData.gdprAccepted
            }}
            onComplete={(data) => {
              console.log('🧪 Dati precompilati (leadData):', leadData);
              console.log('🧪 Dati per initialData:', {
                name: leadData.name || '',
                surname: leadData.surname || '',
                email: leadData.email || '',
                phone: leadData.phone || '',
                eventDate: leadData.eventDate || '',
                notes: leadData.notes || '',
                gdprAccepted: !!leadData.gdprAccepted
              });
              console.log('✅ Lead form completed with data:', data);
              console.log('📊 Previous leadData state:', leadData);
              setLeadData(data);
              setIsCheckoutOpen(true); // Open checkout modal on lead completion
            }}
          />
        </div>
      );
    }

    if (currentPhase === 'services') {
      return (
        <div key="services-step" className="space-y-6">
          {/* Assistant Message */}
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                Ciao! Sono {settings?.studioName ? `di ${settings.studioName}` : 'il tuo assistente'}! 
                Ti aiuterò a creare il pacchetto perfetto per il tuo matrimonio da sogno. 
                Iniziamo con i nostri servizi principali! 📸✨
              </p>
            </div>
          </div>

          {/* Main Services */}
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                🎯 I nostri servizi principali
              </h3>
              <p className="text-sm text-gray-600">
                Seleziona quello che ti interessa di più per iniziare
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {mainServices.map((item) => renderItemCard(item))}
            </div>
          </div>

          {/* Service Categories */}
          <div className="space-y-6">
            {serviceCategories.map((category, categoryIndex) => (
              <div key={`category-${category.key}-${categoryIndex}`} className="space-y-3">
                <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  {category.icon} {category.title}
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {category.items.map((item, itemIndex) => (
                    <div key={`item-${item.id}-${categoryIndex}-${itemIndex}`}>
                      {renderItemCard(item)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (currentPhase === 'products') {
      const products = items.filter(item => item.category === 'prodotto' && item.active !== false);
      const availableProducts = products.filter(item => cart.isItemAvailable(item.id));
      const unavailableProducts = products.filter(item => !cart.isItemAvailable(item.id));

      return (
        <div key="products-step" className="space-y-6">
          {/* Assistant Message */}
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                Ottima scelta! Ora puoi completare il tuo pacchetto aggiungendo altri servizi. 
                Alcuni potrebbero diventare gratuiti se aggiungi tutto! 🎁
              </p>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                🛍️ Prodotti Esclusivi
              </h3>
              <p className="text-sm text-gray-600">
                Aggiungi questi articoli speciali per arricchire il tuo pacchetto
              </p>
            </div>
            <div className="space-y-3">
              {availableProducts.map((item, itemIndex) => (
                <div key={`product-${item.id}-${itemIndex}`}>
                  {renderItemCard(item)}
                </div>
              ))}
            </div>
            {unavailableProducts.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-lg font-semibold text-gray-500 flex items-center gap-2">
                  🔒 Prodotti Bloccati
                </h4>
                <div className="space-y-3">
                  {unavailableProducts.map((item, itemIndex) => (
                    <div key={`unavailable-product-${item.id}-${itemIndex}`}>
                      {renderItemCard(item)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentPhase === 'summary') {
      const pricing = cart.getPricingWithRules();
      const giftItems = cart.getItemsWithRuleInfo().filter(item => item.isGift);
      const giftItemIds = giftItems.map(item => item.id);

      // Calculate comprehensive savings using unified pricing system
      const savingsInfo = discounts ? 
        calculateUnifiedPricing(cart.cart.items, discounts, giftItemIds) :
        {
          subtotal: pricing.total,
          originalSubtotal: pricing.total,
          globalDiscountSavings: 0,
          individualDiscountSavings: 0,
          totalDiscountSavings: 0,
          giftSavings: pricing.giftSavings,
          finalTotal: pricing.total,
          totalSavings: pricing.giftSavings,
          itemDetails: []
        };

      const studioText = settings?.studioName ? ` da ${settings.studioName}` : '';
      let summaryText = `🎉 ECCELLENTE! Ecco il tuo preventivo personalizzato${studioText}:\n\n`;

      if (savingsInfo.totalDiscountSavings > 0 || savingsInfo.giftSavings > 0) {
        summaryText += `💰 Prezzo originale: €${Math.round(savingsInfo.originalSubtotal)}\n`;

        if (savingsInfo.globalDiscountSavings > 0) {
          const globalDiscount = discounts?.global;
          const discountText = globalDiscount?.type === 'percent' ? 
            `${globalDiscount.value}%` : `€${globalDiscount?.value}`;
          summaryText += `💸 Sconto globale (${discountText}): -€${Math.round(savingsInfo.globalDiscountSavings)}\n`;
        }

        if (savingsInfo.individualDiscountSavings > 0) {
          summaryText += `🎯 Sconti speciali prodotti: -€${Math.round(savingsInfo.individualDiscountSavings)}\n`;
        }

        if (savingsInfo.giftSavings > 0) {
          summaryText += `🎁 Risparmi con regali: €${Math.round(savingsInfo.giftSavings)}\n`;
        }

        summaryText += `💰 Totale finale: €${Math.round(savingsInfo.finalTotal)}\n`;
        summaryText += `✨ RISPARMI TOTALI: €${Math.round(savingsInfo.totalSavings)} 💫\n`;
      } else {
        summaryText += `💰 Totale: €${Math.round(savingsInfo.finalTotal)}\n`;
      }

      if (giftItems.length > 0) {
        const giftNames = giftItems.map(item => item.title).join(', ');
        summaryText += `\n🎁 Prodotti GRATUITI: ${giftNames}`;
      }

      summaryText += "\n\nVuoi procedere con la prenotazione?";

      return (
        <div key="summary-step" className="space-y-4">
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src="/api/placeholder/48/48" alt="Assistant" />
              <AvatarFallback className="bg-brand-accent text-white font-bold">
                {settings?.studioName?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 max-w-md">
              <p className="text-gray-800 leading-relaxed">
                {summaryText}
              </p>
            </div>
          </div>
          <div className="text-center pt-4">
            <Button 
              onClick={() => {
                saveChatHistory('phase_started', { 
                  phase: 'lead', 
                  timestamp: new Date(),
                  finalCartTotal: cart.getPricingWithRules().total,
                  finalCartSavings: cart.getPricingWithRules().totalSavings,
                  readyForCheckout: true
                });
                setCurrentPhase('lead');

                // Se i dati del lead sono già completi, apri immediatamente la modale checkout
                const isLeadDataComplete = leadData.name && leadData.surname && leadData.email && leadData.phone && leadData.eventDate;
                if (isLeadDataComplete) {
                  setIsCheckoutOpen(true);
                }
              }}
              className="px-8 py-3 text-lg font-semibold bg-green-600 hover:bg-green-700"
            >
              📝 Inserisci i tuoi dati
            </Button>
          </div>
        </div>
      );
    }

    return null; // Should not happen if currentPhase is handled
  };


  // Progress calculation
  const getProgress = (): number => {
    switch (currentPhase as PhaseType) {
      case 'welcome': return 10; // Increased starting progress
      case 'services': return 40;
      case 'products': return 60;
      case 'summary': return 80;
      case 'lead': return 100;
      case 'collect_name': return 20;
      case 'collect_surname': return 25;
      case 'collect_email': return 30;
      case 'collect_phone': return 35;
      default: return 0;
    }
  };

  const getPhaseLabel = (): string => {
    switch (currentPhase as PhaseType) {
      case 'welcome': return "Benvenuto";
      case 'collect_name': return "Dati Personali";
      case 'collect_surname': return "Dati Personali";
      case 'collect_email': return "Dati Personali";
      case 'collect_phone': return "Dati Personali";
      case 'services': return "Servizi";
      case 'products': return "Prodotti";
      case 'summary': return "Riepilogo";
      case 'lead': return "Prenotazione";
      default: return "";
    }
  };

  // Determine if navigation buttons should be visible and enabled
  const canGoBack = (currentPhase as PhaseType) !== 'welcome' && (currentPhase as PhaseType) !== 'lead' && (currentPhase as PhaseType) !== 'collect_name' && (currentPhase as PhaseType) !== 'collect_surname' && (currentPhase as PhaseType) !== 'collect_email' && (currentPhase as PhaseType) !== 'collect_phone';

  const handleGoBack = () => {
    if (currentPhase === 'services') {
      setCurrentPhase('welcome');
      setMessages([]);
      setTimeout(() => startWelcomePhase(), 100);
    } else if (currentPhase === 'products') {
      setCurrentPhase('services');
    } else if (currentPhase === 'summary') {
      setCurrentPhase('products');
    } else if (currentPhase === 'lead') {
      setCurrentPhase('summary');
    } else if (currentPhase === 'collect_phone') {
      setCurrentPhase('collect_email');
    } else if (currentPhase === 'collect_email') {
      setCurrentPhase('collect_surname');
    } else if (currentPhase === 'collect_surname') {
      setCurrentPhase('collect_name');
    } else if (currentPhase === 'collect_name') {
      setCurrentPhase('welcome');
      setMessages([]);
      setTimeout(() => startWelcomePhase(), 100);
    }
  };

  const startWelcomePhase = () => {
    setCurrentPhase('welcome');
    // Re-trigger welcome message
    createManagedTimeout(() => {
      const studioText = settings?.studioName ? ` di ${settings.studioName}` : '';

      addMessage({
        id: 'welcome-message',
        type: 'assistant',
        avatar: 'smiling',
        text: `Ciao! Sono l'assistente virtuale${studioText}! 👋\n\nSono qui per aiutarti a creare il pacchetto perfetto per il tuo matrimonio da sogno.\n\nQuando pensi di sposarti?`,
        typing: true,
        options: [
          {
            id: 'date-2025',
            label: '📅 2025',
            value: '2025',
            action: () => handleDateSelection('2025')
          },
          {
            id: 'date-2026',
            label: '📅 2026', 
            value: '2026',
            action: () => handleDateSelection('2026')
          },
          {
            id: 'date-later',
            label: '📅 Più avanti',
            value: 'later',
            action: () => handleDateSelection('later')
          }
        ]
      });
    }, 500);
  };

  // Show initial loading screen if critical data is still loading
  if (isLoadingSettings || isLoadingDiscounts || cart.rulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 shadow-lg border border-gray-200 max-w-md mx-4">
          <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Caricamento in corso...</h3>
          <div className="space-y-2 text-sm text-gray-600">
            {isLoadingSettings && <p>📋 Caricamento configurazione...</p>}
            {isLoadingDiscounts && <p>🏷️ Caricamento sconti...</p>}
            {cart.rulesLoading && <p>⚙️ Caricamento regole...</p>}
          </div>
          {!itemsReady && <p className="text-xs text-gray-500 mt-4">Preparazione prodotti e servizi...</p>}
        </div>
      </div>
    );
  }

  // Show error state if there were issues loading critical data
  if (settingsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 shadow-lg border border-red-200 max-w-md mx-4">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Errore di caricamento</h3>
          <p className="text-gray-600 mb-4">{settingsError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Ricarica pagina
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col">
      {/* Enhanced Header with Progress Bar and Navigation */}
      <div className="bg-white border-b flex-shrink-0 shadow-sm">
        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto px-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">
                {getPhaseLabel()} ({getProgress()}%)
              </span>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              {canGoBack && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleGoBack}
                  className="h-8 px-2 text-xs"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Indietro
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  cart.clearCart();
                  setMessages([]);
                  setCurrentPhase('welcome');
                  setLeadData({});
                  startWelcomePhase();
                }}
                className="h-8 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          <Progress value={getProgress()} className="h-2 mb-3" />
        </div>

        {/* Phase Info */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Assistente Matrimonio</h3>
              <p className="text-xs text-gray-500">
                {currentPhase === 'welcome' && "Scegli la data del matrimonio"}
                {currentPhase === 'services' && "Seleziona i servizi che desideri"}
                {currentPhase === 'products' && "Aggiungi prodotti al tuo pacchetto"}
                {currentPhase === 'summary' && "Controlla il preventivo finale"}
                {currentPhase === 'lead' && "Completa i tuoi dati per il preventivo"}
                {currentPhase === 'collect_name' && "Inserisci il tuo nome"}
                {currentPhase === 'collect_surname' && "Inserisci il tuo cognome"}
                {currentPhase === 'collect_email' && "Inserisci la tua email"}
                {currentPhase === 'collect_phone' && "Inserisci il tuo numero di telefono"}
              </p>
            </div>

            {/* Real-time Cart Summary */}
            {cart.cart.items.length > 0 && (
              <div className="text-right text-xs text-gray-700 space-y-1">
                <div>💰 Prezzo originale: €{cart.getPricingWithRules().originalSubtotal}</div>
                {cart.getPricingWithRules().discount > 0 && (
                  <div>💸 Sconto globale: -€{cart.getPricingWithRules().discount}</div>
                )}
                {cart.getPricingWithRules().giftSavings > 0 && (
                  <div>🎁 Risparmio regali: -€{cart.getPricingWithRules().giftSavings}</div>
                )}
                <div className="font-bold text-green-600">
                  💰 Totale finale: €{cart.getPricingWithRules().total}
                </div>
                {cart.getPricingWithRules().totalSavings > 0 && (
                  <div className="text-green-500">
                    ✨ RISPARMI TOTALI: €{cart.getPricingWithRules().totalSavings}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto p-4">
          {messages.map(message => (
            <div key={message.id}>
              {renderMessage(message)}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 mb-4">
              <SpectacularAvatar type="thoughtful" className="flex-shrink-0 w-10 h-10" />
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area - Only for specific phases */}
      {['collect_name', 'collect_surname', 'collect_email', 'collect_phone'].includes(currentPhase) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex gap-2">
              <Input 
                placeholder={
                  currentPhase === 'collect_name' ? "Scrivi il tuo nome..." :
                  currentPhase === 'collect_surname' ? "Scrivi il tuo cognome..." :
                  currentPhase === 'collect_email' ? "Scrivi la tua email..." :
                  currentPhase === 'collect_phone' ? "Scrivi il tuo telefono..." :
                  "Scrivi un messaggio..."
                }
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userInput.trim()) {
                    handleUserInput(userInput);
                  }
                }}
                className="flex-1"
                autoFocus
              />
              <Button
                onClick={() => handleUserInput(userInput)}
                disabled={!userInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        leadData={{
          name: leadData.name || '',
          surname: leadData.surname || '',
          email: leadData.email || '',
          phone: leadData.phone || '',
          eventDate: leadData.eventDate || '',
          notes: leadData.notes || ''
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}