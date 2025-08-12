import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Item } from "@shared/schema";
import ItemCard from "./ItemCard";

type TabType = "servizi" | "prodotti" | "tutti";

export default function Carousel() {
  const [activeTab, setActiveTab] = useState<TabType>("tutti");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        
        // First try simple query without orderBy to avoid index requirement
        let itemsQuery;
        if (activeTab === "tutti") {
          itemsQuery = query(
            collection(db, "items"),
            where("active", "==", true)
          );
        } else {
          itemsQuery = query(
            collection(db, "items"),
            where("active", "==", true),
            where("category", "==", activeTab === "servizi" ? "servizio" : "prodotto")
          );
        }
        
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
          const filteredItems = activeTab === "tutti" 
            ? allItems 
            : allItems.filter(item => 
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

  // Handle window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setCurrentSlide(0); // Reset to first slide on resize
    };

    if (typeof window !== "undefined") {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const slidesPerView = getSlidesPerView();
  const totalSlides = Math.ceil(items.length / slidesPerView);
  
  // Ensure currentSlide doesn't exceed available slides
  useEffect(() => {
    if (currentSlide >= totalSlides && totalSlides > 0) {
      setCurrentSlide(0);
    }
  }, [currentSlide, totalSlides]);
  
  // Debug per verificare il rendering
  useEffect(() => {
    console.log("🎠 Carousel State:", {
      activeTab,
      itemsCount: items.length,
      slidesPerView,
      totalSlides,
      currentSlide,
      currentSlideItems: items.slice(currentSlide * slidesPerView, (currentSlide + 1) * slidesPerView).map(item => item.title)
    });
  }, [items, activeTab, currentSlide, slidesPerView, totalSlides]);

  function getSlidesPerView() {
    if (windowWidth >= 1024) return 3; // Desktop: 3 items per slide
    if (windowWidth >= 768) return 2;  // Tablet: 2 items per slide
    return 1; // Mobile: 1 item per slide
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
        <div className="flex space-x-1 glass rounded-xl p-2">
          <button
            className={`flex-1 py-3 px-3 rounded-lg font-semibold text-xs transition-all duration-300 ${
              activeTab === "tutti"
                ? "text-white shadow-glow"
                : "hover:scale-105"
            }`}
            style={activeTab === "tutti" 
              ? { backgroundColor: 'var(--brand-accent)' }
              : { color: 'var(--brand-accent)' }
            }
            onClick={() => setActiveTab("tutti")}
          >
            TUTTI
          </button>
          <button
            className={`flex-1 py-3 px-3 rounded-lg font-semibold text-xs transition-all duration-300 ${
              activeTab === "servizi"
                ? "text-white shadow-glow"
                : "hover:scale-105"
            }`}
            style={activeTab === "servizi" 
              ? { backgroundColor: 'var(--brand-accent)' }
              : { color: 'var(--brand-accent)' }
            }
            onClick={() => setActiveTab("servizi")}
          >
            SERVIZI
          </button>
          <button
            className={`flex-1 py-3 px-3 rounded-lg font-semibold text-xs transition-all duration-300 ${
              activeTab === "prodotti"
                ? "text-white shadow-glow"
                : "hover:scale-105"
            }`}
            style={activeTab === "prodotti" 
              ? { backgroundColor: 'var(--brand-accent)' }
              : { color: 'var(--brand-accent)' }
            }
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
            activeTab === "tutti"
              ? "text-gradient border-b-3 shadow-glow scale-110"
              : "opacity-70 hover:opacity-100 hover:scale-105"
          }`}
          style={activeTab === "tutti" ? { borderBottom: '3px solid var(--brand-accent)' } : { color: 'var(--brand-accent)' }}
          onClick={() => setActiveTab("tutti")}
        >
          TUTTI
        </button>
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
          style={activeTab === "prodotti" ? { borderBottom: '3px solid var(--brand-accent)' } : { color: 'var(--brand-accent)' }}
          onClick={() => setActiveTab("prodotti")}
        >
          PRODOTTI
        </button>
      </div>

      {/* Carousel Content */}
      {items.length > 0 ? (
        <div>
          <div className="relative overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{
                transform: `translateX(-${currentSlide * 100}%)`,
              }}
            >
              {Array.from({ length: totalSlides }, (_, slideIndex) => (
                <div
                  key={slideIndex}
                  className="flex min-w-full"
                >
                  {items
                    .slice(slideIndex * slidesPerView, (slideIndex + 1) * slidesPerView)
                    .map((item) => (
                      <div 
                        key={item.id} 
                        className="px-1 sm:px-2"
                        style={{ width: `${100 / slidesPerView}%` }}
                      >
                        <ItemCard item={item} />
                      </div>
                    ))}
                  {/* Fill empty slots on last slide */}
                  {slideIndex === totalSlides - 1 &&
                    Array.from({ 
                      length: Math.max(0, slidesPerView - (items.length % slidesPerView || slidesPerView))
                    }, (_, i) => (
                      <div key={`empty-${i}`} style={{ width: `${100 / slidesPerView}%` }} />
                    ))}
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
                  className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                  style={{ color: 'var(--brand-accent)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="flex justify-center space-x-2">
                  {[...Array(totalSlides)].map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-4 h-4 rounded-full transition-all duration-200 hover:scale-125 ${
                        index === currentSlide ? "shadow-lg" : "hover:bg-gray-400"
                      }`}
                      style={{ 
                        backgroundColor: index === currentSlide ? 'var(--brand-accent)' : '#d1d5db'
                      }}
                    />
                  ))}
                </div>
                
                <button
                  onClick={nextSlide}
                  className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                  style={{ color: 'var(--brand-accent)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Items counter */}
              <div className="text-center mt-4 text-sm opacity-70">
                <span style={{ color: 'var(--brand-text-secondary)' }}>
                  Pagina {currentSlide + 1} di {totalSlides} • {items.length} {activeTab === "tutti" ? "elementi" : activeTab}
                </span>
                <div className="text-xs mt-1 hidden sm:block">
                  <span style={{ color: 'var(--brand-text-secondary)' }}>
                    {windowWidth >= 1024 ? "3 elementi per pagina" : windowWidth >= 768 ? "2 elementi per pagina" : "1 elemento per pagina"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {activeTab === "tutti" 
              ? "Nessun articolo disponibile al momento."
              : `Nessun ${activeTab === "servizi" ? "servizio" : "prodotto"} disponibile al momento.`
            }
          </div>
        </div>
      )}
    </div>
  );
}
