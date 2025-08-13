import { useState, useEffect } from 'react';
import { MessageCircle, ChevronLeft, ChevronRight, ShoppingCart, Gift, Tag, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SpectacularAvatar } from './SpectacularAvatar';
import { ChatProductSelector } from './ChatProductSelector';
import { format } from 'date-fns';
import { ActionButtons } from './ActionButtons';
import { LeadForm } from './LeadForm';
import { useImprovedGuideLogic } from './ImprovedGuideLogic';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Item, Discounts } from '@shared/schema';
import CheckoutModal from '../CheckoutModal';

export function FullscreenConversationalGuide() {
  const guide = useImprovedGuideLogic();
  const cart = useCartWithRules();
  const [showTyping, setShowTyping] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [discounts, setDiscounts] = useState<Discounts>({});
  const [isMobile, setIsMobile] = useState(false);
  const [showSpectacularAnimation, setShowSpectacularAnimation] = useState(false);
  const [spectacularMessage, setSpectacularMessage] = useState('');
  const [dateInput, setDateInput] = useState('');

  // Check mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load items and discounts - no filter on isActive
  useEffect(() => {
    const unsubscribeItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      const itemsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Item))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      console.log('Loaded all items:', itemsData);
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

  // Trigger spectacular animations on step changes
  useEffect(() => {
    if (currentStep) {
      // Show spectacular animation for important steps
      if (currentStep.id === 'services_intro' || 
          currentStep.id === 'products_intro' || 
          currentStep.id === 'summary') {
        setShowSpectacularAnimation(true);
        setSpectacularMessage(
          currentStep.id === 'services_intro' ? '🎬 Iniziamo con i SERVIZI!' :
          currentStep.id === 'products_intro' ? '🎁 Ora i PRODOTTI!' :
          '✨ Il tuo preventivo è pronto!'
        );
        setTimeout(() => setShowSpectacularAnimation(false), 3000);
      }
    }
  }, [currentStep?.id]);





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
    <>
      {/* Spectacular Fullscreen Animation */}
      {showSpectacularAnimation && (
        <SpectacularAvatar
          type="excited"
          message={spectacularMessage}
          isFullscreen={true}
          onAnimationComplete={() => setShowSpectacularAnimation(false)}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-3 sm:p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl text-gray-800 truncate">Assistente Matrimonio</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">Ti guido nella creazione del preventivo perfetto</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              {guide.guideState.currentStep + 1}/{guide.generateSteps().length}
            </span>
            <div className="hidden sm:flex gap-1 max-w-32 overflow-x-auto">
              {guide.generateSteps().map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
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
              <SpectacularAvatar 
                type={currentStep.avatar}
                className="flex-shrink-0"
              />
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed">{currentStep.message}</p>
                </div>
              </div>
            </div>

            {/* Date Input for wedding date */}
            {currentStep.id === 'wedding_date' && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleziona la data del matrimonio:
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateInput}
                    onChange={(e) => {
                      setDateInput(e.target.value);
                      if (e.target.value) {
                        guide.setGuideState(prev => ({
                          ...prev,
                          leadData: { 
                            ...prev.leadData, 
                            eventDate: new Date(e.target.value).toISOString() 
                          }
                        }));
                      }
                    }}
                    className="flex-1"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Button 
                    onClick={() => {
                      if (dateInput) {
                        guide.setGuideState(prev => ({
                          ...prev,
                          currentStep: prev.currentStep + 1
                        }));
                      }
                    }}
                    disabled={!dateInput}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Continua →
                  </Button>
                </div>
                {dateInput && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Hai selezionato: {new Date(dateInput).toLocaleDateString('it-IT', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Inline Content Based on Step */}
            {currentStep.customComponent === 'services_selector' && (
              <div className="mt-6">
                <ChatProductSelector 
                  category="servizio" 
                  onComplete={() => {
                    guide.setGuideState(prev => ({ 
                      ...prev, 
                      currentStep: prev.currentStep + 1 
                    }));
                  }}
                />
              </div>
            )}

            {currentStep.customComponent === 'products_selector' && (
              <div className="mt-6">
                <ChatProductSelector 
                  category="prodotto" 
                  onComplete={() => {
                    guide.setGuideState(prev => ({ 
                      ...prev, 
                      currentStep: prev.currentStep + 1 
                    }));
                  }}
                />
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

        {/* Smart Navigation Controls */}
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

            <div className="text-center">
              {!guide.canProceedToNext() && currentStep?.requiresAction && (
                <p className="text-sm text-amber-600 font-medium">
                  ⚠️ Completa l'azione richiesta per continuare
                </p>
              )}
            </div>

            <Button
              variant="outline"
              onClick={guide.nextStep}
              disabled={guide.guideState.currentStep >= guide.generateSteps().length - 1 || !guide.canProceedToNext()}
              className={cn(
                "flex items-center gap-2",
                !guide.canProceedToNext() && "opacity-50 cursor-not-allowed"
              )}
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
    </>
  );
}