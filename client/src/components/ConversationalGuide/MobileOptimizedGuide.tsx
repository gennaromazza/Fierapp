import { useState, useEffect } from 'react';
import { MessageCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatBubble } from './ChatBubble';
import { ActionButtons } from './ActionButtons';
import { LeadForm } from './LeadForm';
import { useGuideLogic } from './useGuideLogic';
import Header from '../Header';
import Footer from '../Footer';
import Carousel from '../Carousel';
import PriceBar from '../PriceBar';
import CheckoutModal from '../CheckoutModal';
import EnhancedSavingsDisplay from '../EnhancedSavingsDisplay';
import RulesInfoPanel from '../RulesInfoPanel';
import { useCartWithRules } from '@/hooks/useCartWithRules';

export function MobileOptimizedGuide() {
  const guide = useGuideLogic();
  const cart = useCartWithRules();
  const [showTyping, setShowTyping] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);

  // Start the guide automatically
  useEffect(() => {
    if (!guide.guideState.isActive) {
      guide.startGuide();
    }
  }, [guide]);

  const currentStep = guide.getCurrentStep();
  const shouldShowUI = currentStep && ['services', 'products', 'summary', 'savings'].includes(currentStep.id);
  const shouldShowLeadForm = currentStep?.id === 'lead_collection';

  return (
    <div className="min-h-screen bg-brand-background flex flex-col">
      <Header />
      
      {/* Mobile Chat Section - Collapsible */}
      <div className="bg-gradient-to-br from-blue-50 to-white border-b border-gray-200">
        {/* Chat Header - Always visible */}
        <div 
          className="p-4 border-b bg-white cursor-pointer flex items-center justify-between"
          onClick={() => setChatExpanded(!chatExpanded)}
        >
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Assistente Matrimonio</h2>
              <p className="text-xs text-gray-600">Creiamo insieme il tuo preventivo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {guide.guideState.currentStep + 1}/{guide.generateSteps().length}
            </span>
            {chatExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Chat Content - Collapsible */}
        {chatExpanded && (
          <div className="p-4 max-h-80 overflow-y-auto">
            {currentStep && (
              <>
                <ChatBubble
                  message={currentStep.message}
                  avatar={currentStep.avatar}
                  showConfetti={currentStep.confetti}
                  isTyping={showTyping}
                  onAnimationComplete={() => setShowTyping(false)}
                />

                {/* Special handling for lead form step */}
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
                    className="mt-4"
                  />
                ) : currentStep.actions && currentStep.actions.length > 0 ? (
                  <ActionButtons actions={currentStep.actions} className="mt-4" />
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Navigation Controls - Always visible */}
        <div className="p-3 border-t bg-white">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={guide.prevStep}
              disabled={guide.guideState.currentStep === 0}
              className="flex items-center gap-1 text-xs px-2 py-1"
            >
              <ChevronLeft className="h-3 w-3" />
              Indietro
            </Button>
            
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
            
            <Button
              variant="outline"
              size="sm"
              onClick={guide.nextStep}
              disabled={guide.guideState.currentStep >= guide.generateSteps().length - 1}
              className="flex items-center gap-1 text-xs px-2 py-1"
            >
              Avanti
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {shouldShowUI ? (
          <main className="pb-32">
            {/* Hero Section with Enhanced Savings */}
            <section className="bg-brand-accent text-white py-6 relative overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
                <div className="animate-fade-in">
                  <h2 className="text-xl md:text-3xl font-bold mb-2 tracking-tight uppercase font-serif">
                    Compila il tuo Preventivo
                  </h2>
                  <p className="text-sm md:text-lg opacity-95 mb-3 font-light">
                    Segui la guida per creare il pacchetto perfetto
                  </p>
                  
                  <EnhancedSavingsDisplay 
                    discount={cart.cart.discount}
                    className={cn(
                      currentStep?.uiHint === 'highlight_global_discount' && 
                      "ring-2 ring-yellow-400 ring-opacity-75"
                    )}
                  />
                </div>
              </div>
            </section>

            {/* Carousel Section */}
            <section className="py-4">
              <div className="max-w-7xl mx-auto px-4">
                <Carousel />
              </div>
            </section>

            {/* Rules Info Panel */}
            <section className="py-2">
              <div className="max-w-7xl mx-auto px-4">
                <RulesInfoPanel />
              </div>
            </section>
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-60">
            <div className="text-center max-w-sm px-4">
              <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Benvenuto nella Guida Conversazionale
              </h3>
              <p className="text-gray-600 text-sm">
                Tocca l'assistente qui sopra per iniziare a creare il tuo preventivo personalizzato
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Price Bar - Fixed at bottom when cart has items */}
      {cart.cart.items.length > 0 && (
        <div 
          className={cn(
            "fixed bottom-0 left-0 right-0 z-40",
            currentStep?.uiHint === 'highlight_cart' && 
            "ring-2 ring-blue-400 ring-opacity-75"
          )}
        >
          <PriceBar onOpenCheckout={() => setIsCheckoutOpen(true)} />
        </div>
      )}

      <Footer />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}