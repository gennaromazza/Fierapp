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
        const itemsQuery = query(
          collection(db, "items"),
          where("active", "==", true),
          where("category", "==", activeTab === "servizi" ? "servizio" : "prodotto"),
          orderBy("sortOrder", "asc")
        );
        
        const snapshot = await getDocs(itemsQuery);
        const itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Item[];
        
        setItems(itemsData);
        setCurrentSlide(0);
      } catch (error) {
        console.error("Error loading items:", error);
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
        <div className="flex space-x-1 bg-brand-secondary/30 rounded-lg p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
              activeTab === "servizi"
                ? "bg-white text-brand-accent shadow-sm"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("servizi")}
          >
            SERVIZI
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
              activeTab === "prodotti"
                ? "bg-white text-brand-accent shadow-sm"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("prodotti")}
          >
            PRODOTTI
          </button>
        </div>
      </div>

      {/* Desktop Tab Navigation */}
      <div className="hidden md:flex items-center justify-center space-x-6 mb-8">
        <button
          className={`font-medium pb-1 transition-colors ${
            activeTab === "servizi"
              ? "text-brand-accent border-b-2 border-brand-accent"
              : "text-gray-600 hover:text-brand-accent"
          }`}
          onClick={() => setActiveTab("servizi")}
        >
          SERVIZI
        </button>
        <button
          className={`font-medium pb-1 transition-colors ${
            activeTab === "prodotti"
              ? "text-brand-accent border-b-2 border-brand-accent"
              : "text-gray-600 hover:text-brand-accent"
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
