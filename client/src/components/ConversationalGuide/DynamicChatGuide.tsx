import { useState, useEffect, useRef } from 'react';
import { Send, ShoppingCart, Gift, Tag, Check, X, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Item, Discount } from '../../../../shared/schema';
import CheckoutModal from '@/components/CheckoutModal';
import { SpectacularAvatar } from './SpectacularAvatar';

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
}

export function DynamicChatGuide() {
  const cart = useCartWithRules();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [discounts, setDiscounts] = useState<Discount | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'welcome' | 'services' | 'products' | 'summary' | 'lead'>('welcome');
  const [leadData, setLeadData] = useState<any>({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [messageCounter, setMessageCounter] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    // ITEMS: one-shot con filtro WHERE active == true
    (async () => {
      try {
        console.log('🔍 DynamicChatGuide: Starting items fetch...');
        
        const itemsRef = collection(db, 'items');
        const qActive = query(itemsRef, where('active', '==', true));
        
        console.log('🔍 DynamicChatGuide: Executing query...');
        const snap = await getDocs(qActive);
        
        console.log('🔍 DynamicChatGuide: Query result - docs count:', snap.docs.length);
        
        const loadedItems = snap.docs.map(doc => {
          const data = doc.data();
          console.log('🔍 Item data:', doc.id, data);
          return {
            id: doc.id,
            ...(data as Omit<Item, 'id'>),
          };
        });

        console.log('🔥 DynamicChatGuide loaded items', loadedItems.length, loadedItems.map(i => ({ id: i.id, title: i.title, category: i.category, active: i.active })));

        if (isMounted) {
          console.log('🔍 DynamicChatGuide: Setting items state...');
          setItems(loadedItems);
        } else {
          console.log('🔍 DynamicChatGuide: Component unmounted, not setting state');
        }
      } catch (err) {
        console.error('❌ Errore caricamento items:', err);
      }
    })();

    // DISCOUNTS: se li vuoi realtime, mantieni onSnapshot
    const unsubscribeDiscounts = onSnapshot(
      collection(db, 'discounts'),
      (snapshot) => {
        const discountDoc = snapshot.docs.find(doc => doc.id === 'global');
        if (discountDoc) setDiscounts(discountDoc.data() as Discount);
      }
    );

    return () => {
      isMounted = false;
      unsubscribeDiscounts();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chat
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        type: 'assistant',
        avatar: 'smiling',
        text: "Ciao! 👋 Sono il tuo assistente personale per il matrimonio perfetto! Ti guiderò nella scelta dei servizi e prodotti migliori con offerte esclusive.",
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
  }, [messages.length]);

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
    addMessage({
      id: `user-date-${Date.now()}`,
      type: 'user',
      text: date === '2025' ? 'Nel 2025' : date === '2026' ? 'Nel 2026' : 'Più avanti'
    });

    setLeadData((prev: any) => ({ ...prev, eventYear: date }));
    
    setTimeout(() => {
      startServicesPhase();
    }, 500);
  };

  const startServicesPhase = () => {
    setCurrentPhase('services');
    
    addMessage({
      id: 'services-intro',
      type: 'assistant',
      avatar: 'enthusiastic',
      text: "Perfetto! Iniziamo con i SERVIZI FONDAMENTALI 🎬📸\n\n💡 SUGGERIMENTO: Scegliendo entrambi i servizi (Foto + Video) sbloccherai prodotti esclusivi e otterrai il massimo risparmio!",
      typing: true
    });

    // Funzione ricorsiva per aspettare che gli items siano caricati
    const waitForItemsAndShowServices = (attempts = 0) => {
      console.log(`🔍 Attempt ${attempts + 1}: Checking items...`, items.length);
      
      if (items.length > 0) {
        console.log('✅ Items loaded, showing services:', items.length);
        
        const services = items.filter(item => {
          const isService = item.category === 'servizio';
          const isActive = item.active !== false;
          console.log('🔍 Service check - Item:', item.title, 'Category:', item.category, 'active:', item.active, 'isService:', isService, 'isActive:', isActive);
          return isService && isActive;
        });
        
        console.log('🔍 Filtered services:', services);
        
        addMessage({
          id: 'services-selection',
          type: 'system',
          text: "Seleziona i servizi che desideri:",
          items: services
        });
      } else if (attempts < 10) { // Max 10 tentativi (10 secondi)
        console.log('⏳ Items not loaded yet, retrying in 1 second...');
        setTimeout(() => waitForItemsAndShowServices(attempts + 1), 1000);
      } else {
        console.error('❌ Timeout waiting for items to load');
        addMessage({
          id: 'services-error',
          type: 'assistant',
          avatar: 'thoughtful',
          text: "⚠️ Si è verificato un errore nel caricamento. Ricarica la pagina per riprovare.",
        });
      }
    };

    // Inizia il controllo dopo 2 secondi
    setTimeout(() => waitForItemsAndShowServices(), 2000);
  };

  const handleItemToggle = (item: Item) => {
    const isSelected = cart.cart.items.some(cartItem => cartItem.id === item.id);
    
    if (isSelected) {
      cart.removeItem(item.id);
      addMessage({
        type: 'user',
        text: `❌ Rimosso: ${item.title}`
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
        const message = isGift 
          ? `🎁 Aggiunto GRATIS: ${item.title}!`
          : `✅ Aggiunto: ${item.title}`;
          
        addMessage({
          type: 'user',
          text: message
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
    
    let summaryText = "🎉 ECCELLENTE! Ecco il tuo preventivo personalizzato:\n\n";
    summaryText += `💰 Totale: €${pricing.total}\n`;
    
    if (pricing.giftSavings > 0) {
      summaryText += `🎁 Risparmi con regali: €${pricing.giftSavings}\n`;
    }
    
    if (pricing.discount > 0) {
      summaryText += `💸 Sconto applicato: €${pricing.discount}\n`;
    }
    
    if (pricing.totalSavings > 0) {
      summaryText += `✨ Risparmi totali: €${pricing.totalSavings}\n`;
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
      addMessage({
        id: 'final-action',
        type: 'assistant',
        avatar: 'smiling',
        text: "Compila i tuoi dati per ricevere il preventivo dettagliato:",
        options: [
          {
            id: 'proceed-checkout',
            label: '📝 Inserisci i tuoi dati',
            value: 'checkout',
            action: () => setCurrentPhase('lead')
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
        <div className="flex items-start justify-between">
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
          <div className="text-right ml-2">
            {isGift ? (
              <div>
                <span className="text-sm font-bold text-green-600">GRATIS</span>
                <div className="text-xs text-gray-500 line-through">€{item.price}</div>
                {giftSettings?.giftText && (
                  <div className="text-xs text-green-600 font-medium">
                    {giftSettings.giftText}
                  </div>
                )}
              </div>
            ) : (
              <span className={cn(
                "text-sm font-bold",
                isUnavailable ? "text-gray-400" : "text-gray-900"
              )}>
                €{item.price}
              </span>
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

              {message.showCart && cart.cart.items.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <h4 className="font-semibold mb-2 text-sm">Riepilogo Ordine:</h4>
                  {cart.cart.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs mb-1">
                      <span>{item.title}</span>
                      <span className={item.price === 0 ? "text-green-600 font-bold" : ""}>
                        {item.price === 0 ? "GRATIS" : `€${item.price}`}
                      </span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2">
                    <div className="flex justify-between font-bold">
                      <span>Totale:</span>
                      <span>€{cart.getPricingWithRules().total}</span>
                    </div>
                  </div>
                </div>
              )}
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
            <form onSubmit={(e) => {
              e.preventDefault();
              setIsCheckoutOpen(true);
            }}>
              <div className="space-y-4">
                <Input placeholder="Nome e Cognome" required />
                <Input type="email" placeholder="Email" required />
                <Input type="tel" placeholder="Telefono" required />
                <Input placeholder="Location del matrimonio" />
                <Button type="submit" className="w-full">
                  Invia Richiesta Preventivo
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-gray-800">Assistente Matrimonio</span>
          </div>
          {cart.cart.items.length > 0 && (
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">{cart.cart.items.length}</span>
              <span className="text-sm text-gray-600">€{cart.getPricingWithRules().total}</span>
            </div>
          )}
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

      {/* Input Area (for future text input) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Scrivi un messaggio..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="flex-1"
            />
            <Button>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}