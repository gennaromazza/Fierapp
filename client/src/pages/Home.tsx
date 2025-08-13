import { useEffect, useState } from "react";
import { analytics, db } from "../firebase";
import { logEvent } from "firebase/analytics";
import { doc, getDoc } from "firebase/firestore";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Carousel from "../components/Carousel";
import PriceBar from "../components/PriceBar";
import CheckoutModal from "../components/CheckoutModal";
import EnhancedSavingsDisplay from "../components/EnhancedSavingsDisplay";
import RulesInfoPanel from "../components/RulesInfoPanel";
import { ConversationalGuide } from "../components/ConversationalGuide";
import { useCartWithRules } from "../hooks/useCartWithRules";
import { useABFlag } from "../hooks/useABFlag";
import type { Settings } from "../../../shared/schema";

export default function Home() {
  const cart = useCartWithRules();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const { flags } = useABFlag();

  useEffect(() => {
    logEvent(analytics, "page_view", {
      page_title: "Home",
      page_location: window.location.href,
    });
    
    // Load settings
    async function loadSettings() {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as Settings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }
    
    loadSettings();
  }, []);

  // If guide_v1 flag is enabled, render the conversational guide homepage
  if (flags.guide_v1) {
    return <ConversationalGuide />;
  }

  // Render standard homepage
  return (
    <div className="min-h-screen bg-brand-background">
      <Header />
      
      <main className="pb-32">
        {/* Hero Section */}
        <section className="bg-brand-accent text-white py-12 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="animate-fade-in">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight uppercase font-serif animate-float">
                {settings?.heroTitle || "OFFERTE SPECIALI FIERA"}
              </h2>
              <p className="text-xl md:text-2xl opacity-95 mb-6 font-light">
                {settings?.heroSubtitle || "Scopri i nostri pacchetti esclusivi con sconti fino al 30%"}
              </p>
              
              {/* Enhanced Savings Display */}
              <EnhancedSavingsDisplay 
                discount={cart.cart.discount}
                className=""
              />
            </div>
          </div>
          
          {/* Animated Decorative elements */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-36 translate-x-36 animate-float"></div>
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/10 rounded-full translate-y-28 -translate-x-28 animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
        </section>

        {/* Carousel Section */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Carousel />
          </div>
        </section>
      </main>

      {/* Price Bar - shown when cart has items */}
      {cart.cart.itemCount > 0 && (
        <PriceBar onOpenCheckout={() => setIsCheckoutOpen(true)} />
      )}
      
      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />

      {/* Rules Info Panel - Always visible */}
      <RulesInfoPanel />

      <Footer />
    </div>
  );
}
