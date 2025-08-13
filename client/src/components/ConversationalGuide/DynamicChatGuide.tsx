import { useState, useEffect, useRef } from 'react';
import { Send, ShoppingCart, Gift, Tag, Check, X, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Item, Discount } from '../../../shared/schema';
import CheckoutModal from '@/components/CheckoutModal';
import { SpectacularAvatar } from './SpectacularAvatar';

interface ChatMessage {
  id: string;
  type: 'assistant' | 'user' | 'system';
  text?: string;
  avatar?: 'smiling' | 'explaining' | 'enthusiastic_money' | 'excited' | 'thoughtful';
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load items and discounts from Firebase
  useEffect(() => {
    const unsubscribeItems = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const loadedItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Item));
        setItems(loadedItems.filter(item => item.active));
      }
    );

    const unsubscribeDiscounts = onSnapshot(
      collection(db, 'discounts'),
      (snapshot) => {
        const discountDoc = snapshot.docs.find(doc => doc.id === 'global');
        if (discountDoc) {
          setDiscounts(discountDoc.data() as Discount);
        }
      }
    );

    return () => {
      unsubscribeItems();
      unsubscribeDiscounts();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chat
  useEffect(() => {
    addMessage({
      id: '1',
      type: 'assistant',
      avatar: 'smiling',
      text: "Ciao! 👋 Sono il tuo assistente personale per il matrimonio perfetto! Ti guiderò nella scelta dei servizi e prodotti migliori con offerte esclusive.",
    });

    setTimeout(() => {
      addMessage({
        id: '2',
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
  }, []);

  const addMessage = (message: ChatMessage) => {
    if (message.typing) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { ...message, typing: false }]);
      }, 1000);
    } else {
      setMessages(prev => [...prev, message]);
    }
  };

  const handleDateSelection = (date: string) => {
    addMessage({
      id: `user-date-${Date.now()}`,
      type: 'user',
      text: date === '2025' ? 'Nel 2025' : date === '2026' ? 'Nel 2026' : 'Più avanti'
    });

    setLeadData(prev => ({ ...prev, eventYear: date }));
    
    setTimeout(() => {
      startServicesPhase();
    }, 500);
  };

  const startServicesPhase = () => {
    setCurrentPhase('services');
    
    addMessage({
      id: 'services-intro',
      type: 'assistant',
      avatar: 'enthusiastic_money',
      text: "Perfetto! Iniziamo con i SERVIZI FONDAMENTALI 🎬📸\n\n💡 SUGGERIMENTO: Scegliendo entrambi i servizi (Foto + Video) sbloccherai prodotti esclusivi e otterrai il massimo risparmio!",
      typing: true
    });

    setTimeout(() => {
      const services = items.filter(item => item.category === 'servizio');
      
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
      cart.removeFromCart(item.id);
      addMessage({
        id: `remove-${Date.now()}`,
        type: 'user',
        text: `❌ Rimosso: ${item.title}`
      });
    } else {
      cart.addToCart({
        id: item.id,
        name: item.title,
        price: item.price,
        category: item.category,
        description: item.description
      });
      addMessage({
        id: `add-${Date.now()}`,
        type: 'user',
        text: `✅ Aggiunto: ${item.name}`
      });
    }

    // Check if should move to next phase
    if (currentPhase === 'services') {
      const selectedServices = cart.cart.items.filter(i => i.category === 'servizio');
      if (selectedServices.length > 0) {
        setTimeout(() => {
          addMessage({
            id: 'services-confirm',
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

  const startProductsPhase = () => {
    setCurrentPhase('products');
    
    const hasPhotoService = cart.cart.items.some(i => i.id === 'bsCHxhOyCn70gtzBAGQQ');
    const hasVideoService = cart.cart.items.some(i => i.id === 'wFwLZdWcjo6tdkhasQbs');
    
    let unlockMessage = "Ora vediamo i PRODOTTI AGGIUNTIVI! 🎁\n\n";
    
    if (hasPhotoService && hasVideoService) {
      unlockMessage += "🎉 FANTASTICO! Hai scelto entrambi i servizi!\n";
      unlockMessage += "✨ Hai sbloccato TUTTI i prodotti esclusivi\n";
      unlockMessage += "🎁 Con il pacchetto completo, Foto Invitati diventa GRATIS!";
    } else if (hasPhotoService) {
      unlockMessage += "📸 Con il servizio fotografico hai sbloccato gli album!";
    } else if (hasVideoService) {
      unlockMessage += "🎬 Con il servizio video hai sbloccato Drone e VideoProiezione!";
    }
    
    addMessage({
      id: 'products-intro',
      type: 'assistant',
      avatar: 'enthusiastic_money',
      text: unlockMessage,
      typing: true
    });

    setTimeout(() => {
      const products = items.filter(item => item.category === 'prodotto');
      
      addMessage({
        id: 'products-selection',
        type: 'system',
        text: "Scegli i prodotti che desideri:",
        items: products
      });
    }, 2000);
  };

  const startSummaryPhase = () => {
    setCurrentPhase('summary');
    
    const total = cart.getPricingWithRules().finalTotal;
    const savings = cart.getPricingWithRules().totalSavings;
    
    addMessage({
      id: 'summary-intro',
      type: 'assistant',
      avatar: 'excited',
      text: `🎉 ECCELLENTE! Ecco il tuo preventivo personalizzato:\n\n💰 Totale: €${total}\n🎁 Risparmi: €${savings}\n\nVuoi procedere con la prenotazione?`,
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
    const isGift = cartItem?.price === 0 && cartItem?.originalPrice && cartItem.originalPrice > 0;
    const unavailableReason = cart.getUnavailableReason(item.id);
    const isUnavailable = !!unavailableReason;

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
                <div className="text-xs text-gray-500 line-through">€{cartItem.originalPrice}</div>
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
            className="flex-shrink-0"
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
                      <span>{item.name}</span>
                      <span className={item.price === 0 ? "text-green-600 font-bold" : ""}>
                        {item.price === 0 ? "GRATIS" : `€${item.price}`}
                      </span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2">
                    <div className="flex justify-between font-bold">
                      <span>Totale:</span>
                      <span>€{cart.getPricingWithRules().finalTotal}</span>
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
          <div className="bg-white rounded-lg p-4 border">
            {message.text && (
              <p className="text-sm text-gray-600 mb-3">{message.text}</p>
            )}
            <div className="space-y-2">
              {message.items.map(item => renderItemCard(item))}
            </div>
            {currentPhase === 'products' && (
              <Button
                onClick={startSummaryPhase}
                className="w-full mt-4 bg-green-600 hover:bg-green-700"
              >
                ✅ Procedi al Riepilogo
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
              <span className="text-sm text-gray-600">€{cart.getPricingWithRules().finalTotal}</span>
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
              <SpectacularAvatar type="thoughtful" className="flex-shrink-0" />
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
              disabled
            />
            <Button disabled>
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