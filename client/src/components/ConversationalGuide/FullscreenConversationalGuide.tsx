import { useState, useEffect } from 'react';
import { MessageCircle, ChevronLeft, ChevronRight, ShoppingCart, Check, Plus, Minus, Gift, Lock, Tag, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar } from './Avatar';
import { ActionButtons } from './ActionButtons';
import { LeadForm } from './LeadForm';
import { useGuideLogic } from './useGuideLogic';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Item, Discounts } from '@shared/schema';
import CheckoutModal from '../CheckoutModal';

export function FullscreenConversationalGuide() {
  const guide = useGuideLogic();
  const cart = useCartWithRules();
  const [showTyping, setShowTyping] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [discounts, setDiscounts] = useState<Discounts>({});
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load items and discounts
  useEffect(() => {
    const unsubscribeItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      const itemsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Item))
        .filter(item => item.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setItems(itemsData);
    });

    const unsubscribeDiscounts = onSnapshot(doc(db, "settings", "discounts"), (doc) => {
      if (doc.exists()) {
        setDiscounts(doc.data() as Discounts);
      }
    });

    return () => {
      unsubscribeItems();
      unsubscribeDiscounts();
    };
  }, []);

  // Start guide automatically
  useEffect(() => {
    if (!guide.guideState.isActive) {
      guide.startGuide();
    }
  }, [guide]);

  const currentStep = guide.getCurrentStep();
  const shouldShowLeadForm = currentStep?.id === 'lead_collection';

  const handleItemClick = (item: Item) => {
    const isSelected = cart.cart.items.some(cartItem => cartItem.id === item.id);
    
    if (isSelected) {
      cart.removeFromCart(item.id);
    } else {
      cart.addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        description: item.description
      });
    }
  };

  const getItemStatus = (item: Item) => {
    const cartItem = cart.cart.items.find(cartItem => cartItem.id === item.id);
    const isSelected = !!cartItem;
    const isGift = cartItem?.price === 0 && cartItem?.originalPrice && cartItem.originalPrice > 0;
    const unavailableReason = cart.getUnavailableReason(item.id);
    
    return {
      isSelected,
      isGift,
      isUnavailable: !!unavailableReason,
      unavailableReason,
      displayPrice: cartItem?.price ?? item.price,
      originalPrice: cartItem?.originalPrice ?? item.price
    };
  };

  const renderProductSelector = (category: 'servizio' | 'prodotto') => {
    const categoryItems = items.filter(item => item.category === category);
    
    if (categoryItems.length === 0) {
      return (
        <div className="text-center py-6">
          <p className="text-gray-500">Caricamento {category === 'servizio' ? 'servizi' : 'prodotti'}...</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {categoryItems.map(item => {
          const status = getItemStatus(item);
          
          return (
            <div
              key={item.id}
              className={cn(
                "border rounded-lg p-4 transition-all cursor-pointer",
                status.isSelected 
                  ? "border-blue-500 bg-blue-50" 
                  : status.isUnavailable
                    ? "border-gray-200 bg-gray-50 opacity-60"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md",
                status.isUnavailable && "cursor-not-allowed"
              )}
              onClick={() => !status.isUnavailable && handleItemClick(item)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn(
                      "font-medium",
                      status.isUnavailable ? "text-gray-400" : "text-gray-900"
                    )}>
                      {item.name}
                    </h4>
                    
                    {status.isSelected && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                    
                    {status.isGift && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        <Gift className="h-3 w-3 mr-1" />
                        GRATIS
                      </Badge>
                    )}
                    
                    {status.isUnavailable && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Bloccato
                      </Badge>
                    )}
                  </div>
                  
                  {item.description && (
                    <p className={cn(
                      "text-sm mb-2",
                      status.isUnavailable ? "text-gray-400" : "text-gray-600"
                    )}>
                      {item.description}
                    </p>
                  )}
                  
                  {status.isUnavailable && status.unavailableReason && (
                    <p className="text-xs text-red-500 italic">
                      {status.unavailableReason}
                    </p>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    {status.isGift ? (
                      <div>
                        <span className="text-lg font-bold text-green-600">GRATIS</span>
                        <div className="text-sm text-gray-500 line-through">
                          €{status.originalPrice}
                        </div>
                      </div>
                    ) : (
                      <span className={cn(
                        "text-lg font-bold",
                        status.isUnavailable ? "text-gray-400" : "text-gray-900"
                      )}>
                        €{status.displayPrice}
                      </span>
                    )}
                  </div>
                  
                  {!status.isUnavailable && (
                    <Button
                      size="sm"
                      variant={status.isSelected ? "default" : "outline"}
                      className="min-w-[80px]"
                    >
                      {status.isSelected ? (
                        <>
                          <Minus className="h-3 w-3 mr-1" />
                          Rimuovi
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Aggiungi
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPriceDisplay = () => {
    if (cart.cart.items.length === 0) {
      return (
        <div className="text-center py-6">
          <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nessun prodotto selezionato</p>
          <p className="text-sm text-gray-400">Inizia a scegliere i tuoi servizi!</p>
        </div>
      );
    }

    const subtotal = cart.cart.items.reduce((sum, item) => {
      return sum + (item.originalPrice || item.price);
    }, 0);

    const giftItems = cart.cart.items.filter(item => item.price === 0 && item.originalPrice);
    const giftSavings = giftItems.reduce((sum, item) => sum + (item.originalPrice || 0), 0);

    const finalTotal = cart.getPricingWithRules().finalTotal;
    const globalDiscount = discounts?.global?.isActive ? (discounts.global.value || 0) : 0;

    return (
      <div className="bg-white border rounded-lg p-4 space-y-4">
        {/* Selected Items */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Prodotti Selezionati ({cart.cart.items.length})
          </h3>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {cart.cart.items.map(item => (
              <div key={item.id} className="flex justify-between items-center py-1">
                <div className="flex-1">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.price === 0 && item.originalPrice && (
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 text-xs">
                      <Gift className="h-3 w-3 mr-1" />
                      GRATIS
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  {item.price === 0 && item.originalPrice ? (
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-green-600">GRATIS</span>
                      <span className="text-xs text-gray-500 line-through">€{item.originalPrice}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-medium">€{item.price}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotale:</span>
            <span>€{subtotal}</span>
          </div>
          
          {giftSavings > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span className="flex items-center gap-1">
                <Gift className="h-3 w-3" />
                Omaggi:
              </span>
              <span>-€{giftSavings}</span>
            </div>
          )}
          
          {globalDiscount > 0 && (
            <div className="flex justify-between text-sm text-blue-600">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Sconto Fiera:
              </span>
              <span>-€{globalDiscount}</span>
            </div>
          )}
          
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Totale:</span>
            <span className="text-blue-600">€{finalTotal}</span>
          </div>
          
          {(giftSavings > 0 || globalDiscount > 0) && (
            <div className="text-center">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <Sparkles className="h-3 w-3 mr-1" />
                Hai risparmiato €{subtotal - finalTotal}!
              </Badge>
            </div>
          )}
        </div>

        {/* Checkout Button */}
        <Button 
          onClick={() => setIsCheckoutOpen(true)}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          Procedi al Preventivo
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="font-bold text-xl text-gray-800">Assistente Matrimonio</h1>
              <p className="text-sm text-gray-600">Ti guido nella creazione del preventivo perfetto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {guide.guideState.currentStep + 1}/{guide.generateSteps().length}
            </span>
            <div className="flex gap-1">
              {guide.generateSteps().map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    index === guide.guideState.currentStep 
                      ? "bg-blue-600" 
                      : index < guide.guideState.currentStep 
                        ? "bg-green-500" 
                        : "bg-gray-300"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col">
        {currentStep && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            {/* Avatar and Message */}
            <div className="flex gap-4 mb-6">
              <Avatar 
                type={currentStep.avatar} 
                showConfetti={currentStep.confetti}
                className="flex-shrink-0"
              />
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed">{currentStep.message}</p>
                </div>
              </div>
            </div>

            {/* Inline Content Based on Step */}
            {currentStep.uiHint === 'show_services_inline' && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-4 text-blue-700">Scegli i tuoi Servizi</h3>
                {renderProductSelector('servizio')}
              </div>
            )}

            {currentStep.uiHint === 'show_products_inline' && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-4 text-green-700">Scegli i tuoi Prodotti</h3>
                {renderProductSelector('prodotto')}
              </div>
            )}

            {(currentStep.uiHint === 'show_cart_inline' || currentStep.id === 'summary') && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-4 text-purple-700">Il tuo Preventivo</h3>
                {renderPriceDisplay()}
              </div>
            )}

            {/* Form or Actions */}
            {shouldShowLeadForm ? (
              <LeadForm
                initialData={guide.guideState.leadData}
                onComplete={(leadData) => {
                  guide.setGuideState(prev => ({
                    ...prev,
                    leadData,
                    currentStep: prev.currentStep + 1
                  }));
                }}
                className="mt-6"
              />
            ) : currentStep.actions && currentStep.actions.length > 0 ? (
              <ActionButtons actions={currentStep.actions} className="mt-6" />
            ) : null}
          </div>
        )}

        {/* Navigation Controls */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={guide.prevStep}
              disabled={guide.guideState.currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Indietro
            </Button>
            
            <Button
              variant="outline"
              onClick={guide.nextStep}
              disabled={guide.guideState.currentStep >= guide.generateSteps().length - 1}
              className="flex items-center gap-2"
            >
              Avanti
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}