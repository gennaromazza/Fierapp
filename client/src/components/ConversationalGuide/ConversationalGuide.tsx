import { useState, useEffect } from 'react';
import { FullscreenConversationalGuide } from './FullscreenConversationalGuide';
import { MobileOptimizedGuide } from './MobileOptimizedGuide';

export function ConversationalGuide() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // More comprehensive mobile detection
      const width = window.innerWidth;
      const userAgent = navigator.userAgent;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      
      setIsMobile(width < 768 || mobileRegex.test(userAgent));
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Use mobile-optimized version for small screens and mobile devices
  if (isMobile) {
    return <MobileOptimizedGuide />;
  }

  // Use fullscreen version for desktop
  return <FullscreenConversationalGuide />;

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
    <div className="min-h-screen bg-brand-background">
      <Header />
      
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Chat Assistant - Full width on mobile, 1/3 on desktop */}
        <div className="w-full md:w-1/3 bg-gradient-to-br from-blue-50 to-white border-b md:border-r border-gray-200 flex flex-col max-h-[60vh] md:max-h-none">
          {/* Chat Header */}
          <div className="p-6 border-b bg-white">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="font-bold text-gray-800">Assistente Matrimonio</h2>
                <p className="text-sm text-gray-600">Creiamo insieme il tuo preventivo</p>
              </div>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 p-6 overflow-y-auto">
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
                    className="mt-6"
                  />
                ) : currentStep.actions && currentStep.actions.length > 0 ? (
                  <ActionButtons actions={currentStep.actions} className="mt-6" />
                ) : null}
              </>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="p-6 border-t bg-white">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={guide.prevStep}
                disabled={guide.guideState.currentStep === 0}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Indietro
              </Button>
              
              <span className="text-sm text-gray-500">
                {guide.guideState.currentStep + 1} / {guide.generateSteps().length}
              </span>
              
              <Button
                variant="outline"
                size="sm"
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

        {/* Interactive UI - Full width on mobile, 2/3 on desktop */}
        <div className="flex-1 flex flex-col min-h-[40vh] md:min-h-auto">
          {shouldShowUI ? (
            <main className="flex-1 pb-32">
              {/* Hero Section with Enhanced Savings */}
              <section className="bg-brand-accent text-white py-8 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                  <div className="animate-fade-in">
                    <h2 className="text-2xl md:text-4xl font-bold mb-4 tracking-tight uppercase font-serif">
                      Compila il tuo Preventivo
                    </h2>
                    <p className="text-lg md:text-xl opacity-95 mb-4 font-light">
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
              <section className="py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <Carousel />
                </div>
              </section>

              {/* Rules Info Panel */}
              <section className="py-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <RulesInfoPanel />
                </div>
              </section>
            </main>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center max-w-md">
                <MessageCircle className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Benvenuto nella Guida Conversazionale
                </h3>
                <p className="text-gray-600">
                  Segui le istruzioni nell'assistente per creare il tuo preventivo personalizzato
                </p>
              </div>
            </div>
          )}

          {/* Price Bar - always visible when cart has items */}
          {cart.cart.items.length > 0 && (
            <div 
              className={cn(
                currentStep?.uiHint === 'highlight_cart' && 
                "ring-2 ring-blue-400 ring-opacity-75"
              )}
            >
              <PriceBar onOpenCheckout={() => setIsCheckoutOpen(true)} />
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}