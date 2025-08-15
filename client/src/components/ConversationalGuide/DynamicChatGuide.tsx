import { useState, useEffect, useRef } from 'react';
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
import { SpectacularAvatar } from './SpectacularAvatar';
import { CalendarIcon } from 'lucide-react';
import { getItemDiscountInfo } from '../../lib/discounts';
import { calculateUnifiedPricing } from '../../lib/unifiedPricing';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/toast-notification';

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
  const cart = useCartWithRules();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [discounts, setDiscounts] = useState<Discounts | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Use items from cart hook instead of loading separately
  const items = cart.getAllItemsWithAvailability() || [];
  const [itemsReady, setItemsReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('welcome');
  const [leadData, setLeadData] = useState<any>({
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

  // Salva dati conversazione su Firebase
  const saveChatHistory = async (eventType: string, data: any = {}) => {
    try {
      await addDoc(collection(db, 'chat_history'), {
        sessionId: conversationData.sessionId,
        eventType,
        data,
        conversationData: {
          ...conversationData,
          currentPhase,
          messagesCount: messages.length,
          cartItemsCount: cart.cart.items.length,
          totalValue: cart.getPricingWithRules().total,
          totalSavings: cart.getPricingWithRules().totalSavings
        },
        timestamp: serverTimestamp(),
        createdAt: new Date()
      });
      
      console.log(`💾 Chat history saved: ${eventType}`, data);
    } catch (error) {
      console.error('Error saving chat history:', error);
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
        }

        // Load settings (studio name, branding, etc.)
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          const settingsData = settingsDoc.data() as Settings;
          setSettings(settingsData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
    }

    loadData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      setTimeout(() => {
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

    // Aggiorna dati conversazione
    setConversationData(prev => ({ ...prev, eventDate: date }));
    setLeadData((prev: any) => ({ ...prev, eventYear: date }));
    
    // Salva selezione data
    saveChatHistory('date_selected', { eventDate: date, dateText });
    
    // Start data collection phase
    setTimeout(() => {
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
    
    setLeadData((prev: any) => ({ ...prev, name }));
    
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
    
    setLeadData((prev: any) => ({ ...prev, surname }));
    
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
    if (!email.includes('@')) {
      addMessage({
        type: 'assistant',
        avatar: 'thoughtful',
        text: 'Mi serve un indirizzo email valido per inviarti il preventivo. Riprova! 😊'
      });
      return;
    }

    addMessage({
      type: 'user',
      text: email
    });
    
    setLeadData((prev: any) => ({ ...prev, email }));
    
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
    
    setLeadData((prev: any) => ({ ...prev, phone }));
    
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
    
    setLeadData((prev: any) => ({ ...prev, eventDate: selectedDate.toISOString().split('T')[0] }));
    
    setTimeout(() => {
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
      id: 'services-intro',
      type: 'assistant',
      avatar: 'enthusiastic',
      text: "Perfetto! Iniziamo con i SERVIZI FONDAMENTALI 🎬📸\n\n💡 SUGGERIMENTO: Scegliendo entrambi i servizi (Foto + Video) sbloccherai prodotti esclusivi e otterrai il massimo risparmio!",
      typing: true
    });

    // Attendi 2 secondi poi controlla se gli items sono pronti
    setTimeout(() => {
      if (!itemsReady) {
        console.log('⏳ Items not ready yet, showing loading message...');
        addMessage({
          id: 'services-loading',
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
        id: 'services-selection',
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
      toast({
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
        
        // Usa toast invece di messaggio chat
        if (isGift) {
          toast({
            title: "🎁 Regalo Sbloccato!",
            description: `${item.title} è ora GRATUITO!`,
            variant: "success",
            duration: 4000,
          });
        } else {
          toast({
            title: "✅ Aggiunto",
            description: `${item.title} aggiunto al carrello`,
            variant: "default",
            duration: 3000,
          });
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

    setTimeout(() => {
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
        `Compila i tuoi dati per ricevere il preventivo dettagliato di ${settings.studioName}:` :
        "Compila i tuoi dati per ricevere il preventivo dettagliato:";
      
      addMessage({
        id: 'final-action',
        type: 'assistant',
        avatar: 'smiling',
        text: contactText,
        options: [
          {
            id: 'proceed-checkout',
            label: '📝 Inserisci i tuoi dati',
            value: 'checkout',
            action: () => {
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
        ]
      });
    }, 2000);
  };

  const renderItemCard = (item: Item) => {
    const cartItem = cart.cart.items.find(ci => ci.id === item.id);
    const isSelected = !!cartItem;
    const isAvailable = cart.isItemAvailable(item.id);
    const isGift = cart.isItemGift(item.id);
    const giftSettings = cart.getItemGiftSettings(item.id);
    const unavailableReason = !isAvailable ? cart.getUnavailableReason(item.id) : null;
    const isUnavailable = !isAvailable;
    
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
            {item.description && (
              <p className={cn(
                "text-xs mt-1",
                isUnavailable ? "text-gray-400" : "text-gray-600"
              )}>
                {item.description?.substring(0, 50)}...
              </p>
            )}
            {unavailableReason && (
              <p className="text-xs text-red-500 mt-1">
                {unavailableReason}
              </p>
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
  };

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
                      const finalPrice = item.price === 0 ? 0 : discountInfo.finalPrice; // Keep gifts as 0
                      const hasDiscount = discountInfo.discountType !== null && item.price > 0;
                      
                      return (
                        <div key={item.id} className="flex justify-between text-xs mb-1">
                          <span>{item.title}</span>
                          <div className="flex items-center gap-2">
                            {hasDiscount && (
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
                          €{cartSavingsInfo.finalTotal}
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
    
    return null;
  };

  // Lead form in chat
  if (currentPhase === 'lead') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col">
        <div className="flex-1 max-w-2xl mx-auto w-full p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
            <h2 className="text-2xl font-bold mb-4">Completa la prenotazione</h2>
            <LeadForm 
              initialData={{
                name: leadData.name || '',
                surname: leadData.surname || '',
                email: leadData.email || '',
                phone: leadData.phone || '',
                eventDate: leadData.eventDate || '',
                notes: '',
                gdprAccepted: false
              }}
              onComplete={(data) => {
                console.log('Lead data collected:', data);
                setLeadData(data);
                setIsCheckoutOpen(true);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Progress calculation
  const getProgress = (): number => {
    switch (currentPhase as PhaseType) {
      case 'welcome': return 20;
      case 'services': return 40;
      case 'products': return 60;
      case 'summary': return 80;
      case 'lead': return 100;
      default: return 0;
    }
  };

  const getPhaseLabel = (): string => {
    switch (currentPhase as PhaseType) {
      case 'welcome': return "Benvenuto";
      case 'services': return "Servizi";
      case 'products': return "Prodotti";
      case 'summary': return "Riepilogo";
      case 'lead': return "Prenotazione";
      default: return "";
    }
  };

  const canGoBack = (currentPhase as PhaseType) !== 'welcome' && (currentPhase as PhaseType) !== 'lead';
  const canSkipForward = currentPhase === 'services' || currentPhase === 'products';

  const handleGoBack = () => {
    if (currentPhase === 'services') {
      setCurrentPhase('welcome');
      setMessages([]);
      setTimeout(() => startWelcomePhase(), 100);
    } else if (currentPhase === 'products') {
      setCurrentPhase('services');
      startServicesPhase();
    } else if (currentPhase === 'summary') {
      setCurrentPhase('products');
      startProductsPhase();
    }
  };

  const handleSkipForward = () => {
    if (currentPhase === 'services' && cart.cart.items.length > 0) {
      startProductsPhase();
    } else if (currentPhase === 'products') {
      startSummaryPhase();
    }
  };

  const startWelcomePhase = () => {
    setCurrentPhase('welcome');
    // Re-trigger welcome message
    setTimeout(() => {
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
              
              {canSkipForward && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSkipForward}
                  className="h-8 px-2 text-xs"
                  disabled={currentPhase === 'services' && cart.cart.items.length === 0}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Avanti
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
                {(currentPhase as PhaseType) === 'welcome' && "Scegli la data del matrimonio"}
                {(currentPhase as PhaseType) === 'services' && "Seleziona i servizi fondamentali"}
                {(currentPhase as PhaseType) === 'products' && "Aggiungi prodotti esclusivi"}
                {(currentPhase as PhaseType) === 'summary' && "Controlla il preventivo"}
                {(currentPhase as PhaseType) === 'lead' && "Completa la prenotazione"}
              </p>
            </div>
            
            {/* Real-time Cart Summary */}
            {cart.cart.items.length > 0 && (
              <div className="text-right">
                <div className="text-xs text-gray-500">Carrello</div>
                <div className="font-semibold text-green-600">
                  €{cart.getPricingWithRules().total}
                </div>
                {cart.getPricingWithRules().totalSavings > 0 && (
                  <div className="text-xs text-green-500">
                    Risparmi: €{cart.getPricingWithRules().totalSavings}
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

      {/* Input Area - Solo durante le fasi di raccolta dati */}
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
      />
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}