import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Item } from "@shared/schema";
import ItemCard from "./ItemCard";

type TabType = "servizi" | "prodotti";

export default function Carousel() {
  const [activeTab, setActiveTab] = useState<TabType>("servizi");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        
        // First try simple query without orderBy to avoid index requirement
        let itemsQuery = query(
          collection(db, "items"),
          where("active", "==", true),
          where("category", "==", activeTab === "servizi" ? "servizio" : "prodotto")
        );
        
        const snapshot = await getDocs(itemsQuery);
        let itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Item[];
        
        // Sort manually by sortOrder 
        itemsData.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        setItems(itemsData);
        setCurrentSlide(0);
        
        // If we got data successfully, log that we need indices for optimization
        if (itemsData.length > 0) {
          console.info(
            "🔥 FIREBASE INDEX NEEDED: Per ottimizzare le query, crea un indice composito in Firestore per:\n" +
            "Collezione: items\n" +
            "Campi: active (ASC), category (ASC), sortOrder (ASC)\n" +
            "Vai su: Firebase Console > Firestore Database > Indexes"
          );
        }
        
      } catch (error: any) {
        console.error("Error loading items:", error);
        
        // Check if it's specifically an index error
        if (error.code === 'failed-precondition' && error.message?.includes('index')) {
          console.warn(
            "🚨 FIREBASE INDEX REQUIRED: Devi creare un indice composito in Firestore.\n" +
            "Collezione: items\n" +
            "Campi: active (ASC), category (ASC), sortOrder (ASC)\n" +
            "Link: " + (error.message.match(/https:\/\/[^\s]+/) || ['Console Firebase > Firestore Database > Indexes'])[0]
          );
        }
        
        // Try simpler query without category filter
        try {
          const simpleQuery = query(collection(db, "items"), where("active", "==", true));
          const simpleSnapshot = await getDocs(simpleQuery);
          let allItems = simpleSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          })) as Item[];
          
          // Filter by category manually
          const filteredItems = allItems.filter(item => 
            item.category === (activeTab === "servizi" ? "servizio" : "prodotto")
          );
          
          // Sort manually
          filteredItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          
          setItems(filteredItems);
          console.info("✅ Caricati " + filteredItems.length + " items dal database");
          
        } catch (fallbackError) {
          console.error("Fallback query failed:", fallbackError);
          setItems([]); // Empty instead of demo data - show real database state
        }
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, [activeTab]);

  const totalSlides = Math.ceil(items.length / getSlidesPerView());

  function getSlidesPerView() {
    if (typeof window !== "undefined") {
      if (window.innerWidth >= 1024) return 3;
      if (window.innerWidth >= 768) return 2;
    }
    return 1;
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="flex space-x-1 bg-brand-secondary/30 rounded-lg p-1 mb-6 md:hidden">
          <div className="flex-1 py-2 px-4 rounded-md bg-gray-300 h-10"></div>
          <div className="flex-1 py-2 px-4 rounded-md bg-gray-300 h-10"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg p-6">
              <div className="w-full h-48 bg-gray-300 rounded-lg mb-4"></div>
              <div className="h-6 bg-gray-300 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 rounded mb-4"></div>
              <div className="h-10 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile Tab Navigation */}
      <div className="md:hidden pb-3">
        <div className="flex space-x-2 glass rounded-xl p-2">
          <button
            className={`flex-1 py-3 px-5 rounded-lg font-semibold text-sm transition-all duration-300 ${
              activeTab === "servizi"
                ? "gradient-accent text-white shadow-glow"
                : "hover:scale-105"
            }`}
            style={activeTab !== "servizi" ? { color: 'var(--brand-accent)' } : {}}
            onClick={() => setActiveTab("servizi")}
          >
            SERVIZI
          </button>
          <button
            className={`flex-1 py-3 px-5 rounded-lg font-semibold text-sm transition-all duration-300 ${
              activeTab === "prodotti"
                ? "gradient-accent text-white shadow-glow"
                : "hover:scale-105"
            }`}
            style={activeTab !== "prodotti" ? { color: 'var(--brand-accent)' } : {}}
            onClick={() => setActiveTab("prodotti")}
          >
            PRODOTTI
          </button>
        </div>
      </div>

      {/* Desktop Tab Navigation */}
      <div className="hidden md:flex items-center justify-center space-x-8 mb-10">
        <button
          className={`font-semibold text-lg pb-2 transition-all duration-300 ${
            activeTab === "servizi"
              ? "text-gradient border-b-3 shadow-glow scale-110"
              : "opacity-70 hover:opacity-100 hover:scale-105"
          }`}
          style={activeTab === "servizi" ? { borderBottom: '3px solid var(--brand-accent)' } : { color: 'var(--brand-accent)' }}
          onClick={() => setActiveTab("servizi")}
        >
          SERVIZI
        </button>
        <button
          className={`font-semibold text-lg pb-2 transition-all duration-300 ${
            activeTab === "prodotti"
              ? "text-gradient border-b-3 shadow-glow scale-110"
              : "opacity-70 hover:opacity-100 hover:scale-105"
          }`}
          onClick={() => setActiveTab("prodotti")}
        >
          PRODOTTI
        </button>
      </div>

      {/* Carousel Content */}
      {items.length > 0 ? (
        <div>
          <div className="swiper-container">
            <div 
              className="swiper-wrapper"
              style={{
                transform: `translateX(-${currentSlide * (100 / getSlidesPerView())}%)`,
              }}
            >
              {items.map((item) => (
                <div key={item.id} className="swiper-slide px-2">
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          {totalSlides > 1 && (
            <>
              {/* Carousel Navigation Arrows */}
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={prevSlide}
                  className="p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                  disabled={currentSlide === 0}
                >
                  <svg className="w-5 h-5 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="flex justify-center space-x-2">
                  {[...Array(totalSlides)].map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentSlide ? "bg-brand-accent" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
                
                <button
                  onClick={nextSlide}
                  className="p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                  disabled={currentSlide === totalSlides - 1}
                >
                  <svg className="w-5 h-5 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            Nessun {activeTab === "servizi" ? "servizio" : "prodotto"} disponibile al momento.
          </div>
        </div>
      )}
    </div>
  );
}
