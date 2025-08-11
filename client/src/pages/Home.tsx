import { useEffect } from "react";
import { analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Carousel from "../components/Carousel";
import PriceBar from "../components/PriceBar";
import CheckoutModal from "../components/CheckoutModal";
import EnhancedSavingsDisplay from "../components/EnhancedSavingsDisplay";
import { useCart } from "../hooks/useCart";

export default function Home() {
  const { cart } = useCart();

  useEffect(() => {
    logEvent(analytics, "page_view", {
      page_title: "Home",
      page_location: window.location.href,
    });
  }, []);

  return (
    <div className="min-h-screen bg-brand-primary">
      <Header />
      
      <main className="pb-32">
        {/* Hero Section */}
        <section className="brand-gradient text-white py-8 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="animate-fade-in">
              <h2 className="text-2xl md:text-4xl font-bold mb-2 tracking-tight uppercase">
                OFFERTE SPECIALI FIERA
              </h2>
              <p className="text-lg md:text-xl opacity-90 mb-4">
                Scopri i nostri pacchetti esclusivi con sconti fino al 30%
              </p>
              
              {/* Enhanced Savings Display */}
              <EnhancedSavingsDisplay 
                discount={cart.discount}
                className="animate-pulse"
              />
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        </section>

        {/* Carousel Section */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Carousel />
          </div>
        </section>
      </main>

      {/* Price Bar - shown when cart has items */}
      {cart.itemCount > 0 && <PriceBar />}
      
      {/* Checkout Modal */}
      <CheckoutModal isOpen={false} onClose={() => {}} />

      <Footer />
    </div>
  );
}
