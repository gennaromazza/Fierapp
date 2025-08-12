import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot, collection, query, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Item, Discounts } from "@shared/schema";
import { useCartWithRules } from "../hooks/useCartWithRules";
import { calculateDiscountedPrice } from "../lib/discounts";
import { useCarouselNavigation } from "./Carousel";
import { Plus, Check, Clock, Gift, ExternalLink } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";

interface ItemCardProps {
  item: Item;
}

export default function ItemCard({ item }: ItemCardProps) {
  const { addItem, removeItem, isInCart, isItemAvailable, isItemGift, getItemGiftSettings, getUnavailableReason, getRequiredItemIds } = useCartWithRules();
  
  // Accesso al context del carousel per la navigazione  
  let carouselContext = null;
  try {
    carouselContext = useCarouselNavigation();
  } catch (error) {
    // ItemCard può essere usato fuori dal context del carousel
    console.log("ItemCard usato fuori dal context del carousel");
  }
  const [discounts, setDiscounts] = useState<Discounts | null>(null);
  const [discountExpiry, setDiscountExpiry] = useState<Date | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const isAdded = isInCart(item.id);
  const itemAvailable = isItemAvailable(item.id);
  const itemIsGift = isItemGift(item.id);
  const giftSettings = getItemGiftSettings(item.id);
  
  // Log per debug quando un item diventa regalo
  useEffect(() => {
    if (itemIsGift) {
      console.log(`✨ ${item.title} è ora un OMAGGIO!`, giftSettings);
    }
  }, [itemIsGift, item.title, giftSettings]);

  // Function to truncate text to a specific word count
  const truncateText = (text: string, wordLimit: number = 15) => {
    const words = text.split(' ');
    if (words.length <= wordLimit) {
      return text;
    }
    return words.slice(0, wordLimit).join(' ');
  };

  const shouldTruncate = item.description && item.description.split(' ').length > 15;
  const displayDescription = shouldTruncate && !showFullDescription 
    ? truncateText(item.description, 15)
    : item.description;

  // Funzione per navigare verso un elemento richiesto
  const navigateToRequiredItem = (itemId: string) => {
    // Prima prova la navigazione tramite carousel context
    if (carouselContext) {
      const targetSlide = carouselContext.findItemSlide(itemId);
      if (targetSlide !== null && targetSlide !== carouselContext.currentSlide) {
        // Naviga alla slide corretta
        carouselContext.goToSlide(targetSlide);
        
        // Aspetta un momento per far caricare la slide, poi scrolla e evidenzia
        setTimeout(() => {
          const element = document.querySelector(`[data-item-id="${itemId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Effetto di evidenziazione temporanea
            element.classList.add('ring-2', 'ring-blue-400');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-400');
            }, 2000);
          }
        }, 300);
        return;
      }
    }
    
    // Fallback: navigazione tradizionale con scroll
    const element = document.querySelector(`[data-item-id="${itemId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Effetto di evidenziazione temporanea
      element.classList.add('ring-2', 'ring-blue-400');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-400');
      }, 2000);
    }
  };

  // Crea messaggio cliccabile per le dipendenze
  const createClickableMessage = (reason: string) => {
    const requiredIds = getRequiredItemIds(item.id);
    
    if (requiredIds.length === 0 || !reason.includes('Richiede:')) {
      return <span>{reason}</span>;
    }

    return (
      <div className="space-y-1">
        <span>{reason.split('Richiede:')[0]}Richiede:</span>
        <div className="flex flex-wrap gap-1">
          {requiredIds.map((requiredId, index) => {
            // Trova il nome del prodotto richiesto dal messaggio
            const startIdx = reason.indexOf('Richiede:') + 9;
            const reqText = reason.substring(startIdx).trim();
            const itemNames = reqText.includes(',') ? reqText.split(',').map(n => n.trim()) : [reqText];
            const itemName = itemNames[index] || reqText;
            
            return (
              <button
                key={requiredId}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToRequiredItem(requiredId);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md text-xs font-medium transition-colors duration-200 border border-blue-300"
              >
                <span>{itemName}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Use real-time listener for discounts
    const unsubscribe = onSnapshot(doc(db, "settings", "discounts"), (discountsDoc) => {
      if (discountsDoc.exists()) {
        const discountsData = discountsDoc.data() as Discounts;
        
        // Convert Firebase Timestamps to Date objects safely
        const processedDiscounts = { ...discountsData };
        
        // Process global discount dates
        if (processedDiscounts.global?.startDate) {
          if (processedDiscounts.global.startDate && typeof processedDiscounts.global.startDate === 'object' && 'toDate' in processedDiscounts.global.startDate) {
            processedDiscounts.global.startDate = (processedDiscounts.global.startDate as any).toDate();
          } else if (typeof processedDiscounts.global.startDate === 'string' || typeof processedDiscounts.global.startDate === 'number') {
            const date = new Date(processedDiscounts.global.startDate);
            processedDiscounts.global.startDate = isNaN(date.getTime()) ? undefined : date;
          }
        }
        
        if (processedDiscounts.global?.endDate) {
          if (processedDiscounts.global.endDate && typeof processedDiscounts.global.endDate === 'object' && 'toDate' in processedDiscounts.global.endDate) {
            processedDiscounts.global.endDate = (processedDiscounts.global.endDate as any).toDate();
          } else if (typeof processedDiscounts.global.endDate === 'string' || typeof processedDiscounts.global.endDate === 'number') {
            const date = new Date(processedDiscounts.global.endDate);
            processedDiscounts.global.endDate = isNaN(date.getTime()) ? undefined : date;
          }
        }
        
        // Process item-specific discount dates
        if (processedDiscounts.perItemOverrides) {
          Object.keys(processedDiscounts.perItemOverrides).forEach(key => {
            const itemDiscount = processedDiscounts.perItemOverrides![key];
            
            if (itemDiscount.startDate) {
              if (itemDiscount.startDate && typeof itemDiscount.startDate === 'object' && 'toDate' in itemDiscount.startDate) {
                itemDiscount.startDate = (itemDiscount.startDate as any).toDate();
              } else if (typeof itemDiscount.startDate === 'string' || typeof itemDiscount.startDate === 'number') {
                const date = new Date(itemDiscount.startDate);
                itemDiscount.startDate = isNaN(date.getTime()) ? undefined : date;
              }
            }
            
            if (itemDiscount.endDate) {
              if (itemDiscount.endDate && typeof itemDiscount.endDate === 'object' && 'toDate' in itemDiscount.endDate) {
                itemDiscount.endDate = (itemDiscount.endDate as any).toDate();
              } else if (typeof itemDiscount.endDate === 'string' || typeof itemDiscount.endDate === 'number') {
                const date = new Date(itemDiscount.endDate);
                itemDiscount.endDate = isNaN(date.getTime()) ? undefined : date;
              }
            }
          });
        }
        
        setDiscounts(processedDiscounts);
        
        // Check for discount expiry
        const itemDiscount = processedDiscounts.perItemOverrides?.[item.id] || processedDiscounts.global;
        if (itemDiscount?.endDate) {
          setDiscountExpiry(itemDiscount.endDate);
        } else {
          setDiscountExpiry(null);
        }
      } else {
        // Set default discount structure if document doesn't exist
        setDiscounts({
          global: { type: "percent", value: 0, isActive: false }
        });
        setDiscountExpiry(null);
      }
    }, (error) => {
      console.error("Error loading discounts:", error);
      // Set fallback discounts in case of error  
      setDiscounts({
        global: { type: "percent", value: 0, isActive: false }
      });
      setDiscountExpiry(null);
    });

    return () => unsubscribe();
  }, [item.id]);

  const discountedPrice = discounts ? calculateDiscountedPrice(item.price, item.id, discounts) : item.price;
  const originalPrice = item.originalPrice || item.price;
  const savings = originalPrice - discountedPrice;
  const discountPercent = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  
  // Check if discount is expired
  const isDiscountExpired = discountExpiry ? isAfter(new Date(), discountExpiry) : false;
  const isDiscountActive = !isDiscountExpired && savings > 0;

  const handleToggle = () => {
    // Verifica se l'item è disponibile secondo le regole
    if (!itemAvailable && !isAdded) {
      console.warn(`Item ${item.title} non disponibile secondo le regole di selezione`);
      return;
    }
    
    if (isAdded) {
      console.log(`🗑️ Rimuovo ${item.title} dal carrello`);
      removeItem(item.id);
    } else {
      // Usa il prezzo finale: 0 se è un regalo, altrimenti il prezzo scontato
      const finalPrice = itemIsGift ? 0 : discountedPrice;
      
      console.log(`🛒 Aggiungo ${item.title}: isGift=${itemIsGift}, price=${finalPrice}`);
      
      addItem({
        id: item.id,
        title: item.title,
        price: finalPrice,
        originalPrice: originalPrice,
        imageUrl: item.imageUrl,
        category: item.category,
      });
    }
  };

  return (
    <div 
      className="card-premium rounded-xl overflow-hidden hover-lift group h-[600px] flex flex-col"
      data-item-id={item.id}
    >
      {/* Image with discount badge */}
      <div className="relative flex-shrink-0">
        {item.imageUrl ? (
          <img 
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-48 bg-brand-surface flex items-center justify-center">
            <span className="text-brand-text-secondary opacity-50">Nessuna immagine</span>
          </div>
        )}
        
        {/* Discount Badge - positioned above image */}
        {isDiscountActive && discountPercent > 0 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-2 rounded-full text-sm font-bold shadow-2xl border-2 border-white z-20" style={{ backdropFilter: 'blur(4px)' }}>
            -{discountPercent}%
          </div>
        )}
        
        {/* Gift Badge - positioned above image - Mostra sempre se è un regalo */}
        {itemIsGift && (
          <div className="absolute top-3 left-3 bg-green-600 text-white px-4 py-2 rounded-full text-base font-bold shadow-2xl border-2 border-white z-20 flex items-center space-x-2 transform scale-110" style={{ backdropFilter: 'blur(4px)' }}>
            <Gift className="w-5 h-5" />
            <span>OMAGGIO!</span>
          </div>
        )}
        
        {/* Free Badge - positioned above image (for discounted items) */}
        {!itemIsGift && discountedPrice === 0 && (
          <div className="absolute top-3 left-3 bg-green-600 text-white px-3 py-2 rounded-full text-sm font-bold shadow-2xl border-2 border-white z-20" style={{ backdropFilter: 'blur(4px)' }}>
            GRATIS
          </div>
        )}
        
        {/* Unavailable Overlay - Only dims the image */}
        {!itemAvailable && (
          <div className="absolute inset-0 bg-gray-500/50 z-10"></div>
        )}
        
        {/* Expiry Notice - positioned above image */}
        {discountExpiry && isDiscountActive && (
          <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-2xl z-20" style={{ backdropFilter: 'blur(4px)' }}>
            <Clock className="w-3 h-3 inline mr-1" />
            <span>
              {format(discountExpiry, "d MMM", { locale: it })}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex-grow">
          <h3 className="text-xl font-bold text-brand-accent mb-2">{item.title}</h3>
          {item.subtitle && (
            <p className="text-sm text-gray-500 mb-2">{item.subtitle}</p>
          )}
          {item.description && (
            <div className="text-gray-600 mb-4">
              <p>{displayDescription}</p>
              {shouldTruncate && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-brand-accent hover:underline text-sm font-medium mt-1"
                >
                  {showFullDescription ? "Mostra meno" : "Continua a leggere"}
                </button>
              )}
            </div>
          )}
          
          {/* Price Display with Savings */}
          <div className="space-y-2 mb-4">
            {savings > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 line-through">
                  €{originalPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
                <div className="flex flex-col items-end">
                  <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                    -€{savings.toLocaleString('it-IT')}
                  </span>
                  
                </div>
              </div>
            )}
            {/* Prezzo con supporto regali */}
            <div className="space-y-1">
              {itemIsGift && giftSettings?.showOriginalPrice && (
                <div className="text-sm text-gray-500 line-through">
                  €{originalPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              )}
              <div className={`text-2xl font-bold price-drop ${itemIsGift || discountedPrice === 0 ? 'text-green-600' : 'text-brand-accent'}`}>
                {itemIsGift ? 'GRATIS' : discountedPrice === 0 ? 'GRATIS' : `€${discountedPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>
        </div>
        
        {/* Unavailable Notice - Above button for better visibility */}
        {!itemAvailable && (
          <div className="bg-orange-100 border border-orange-300 text-orange-800 px-4 py-2 rounded-lg text-sm mb-3 text-center">
            <div className="font-semibold">Non Disponibile</div>
            <div className="text-xs mt-1">
              {createClickableMessage(getUnavailableReason(item.id))}
            </div>
          </div>
        )}
        
        {/* Add/Remove Button - Fixed at bottom */}
        <button
          onClick={handleToggle}
          disabled={!itemAvailable && !isAdded}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2 ${
            !itemAvailable && !isAdded
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : isAdded
              ? "bg-green-600 text-white hover:bg-green-700"
              : itemIsGift || discountedPrice === 0
              ? "bg-green-600 text-white hover:bg-green-700"
              : "text-white hover:opacity-90"
          }`}
          style={!isAdded && !itemAvailable ? {} : !isAdded && (itemIsGift || discountedPrice === 0) ? {} : !isAdded ? { backgroundColor: 'var(--brand-accent)' } : {}}
        >
          {isAdded ? (
            <>
              <Check className="w-5 h-5" />
              <span>AGGIUNTO</span>
            </>
          ) : (
            <>
              {discountedPrice === 0 ? (
                <Gift className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              <span>
                {discountedPrice === 0 ? "AGGIUNGI OMAGGIO" : "AGGIUNGI AL PREVENTIVO"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
