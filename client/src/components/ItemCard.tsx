import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Item, Discounts } from "@shared/schema";
import { useCartWithRules } from "../hooks/useCartWithRules";
import { calculateDiscountedPrice } from "../lib/discounts";
import { Plus, Check, Clock, Gift } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";

interface ItemCardProps {
  item: Item;
}

export default function ItemCard({ item }: ItemCardProps) {
  const { addItem, removeItem, isInCart, isItemAvailable, isItemGift, getItemGiftSettings, getUnavailableReason } = useCartWithRules();
  const [discounts, setDiscounts] = useState<Discounts | null>(null);
  const [discountExpiry, setDiscountExpiry] = useState<Date | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const isAdded = isInCart(item.id);
  const itemAvailable = isItemAvailable(item.id);
  const itemIsGift = isItemGift(item.id);
  const giftSettings = getItemGiftSettings(item.id);

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

  useEffect(() => {
    // Use real-time listener for discounts
    const unsubscribe = onSnapshot(doc(db, "settings", "discounts"), (discountsDoc) => {
      if (discountsDoc.exists()) {
        const discountsData = discountsDoc.data() as Discounts;
        
        // Convert Firebase Timestamps to Date objects safely
        const processedDiscounts = { ...discountsData };
        
        // Process global discount dates
        if (processedDiscounts.global?.startDate) {
          if (processedDiscounts.global.startDate.toDate && typeof processedDiscounts.global.startDate.toDate === 'function') {
            processedDiscounts.global.startDate = processedDiscounts.global.startDate.toDate();
          } else if (typeof processedDiscounts.global.startDate === 'string' || typeof processedDiscounts.global.startDate === 'number') {
            const date = new Date(processedDiscounts.global.startDate);
            processedDiscounts.global.startDate = isNaN(date.getTime()) ? undefined : date;
          }
        }
        
        if (processedDiscounts.global?.endDate) {
          if (processedDiscounts.global.endDate.toDate && typeof processedDiscounts.global.endDate.toDate === 'function') {
            processedDiscounts.global.endDate = processedDiscounts.global.endDate.toDate();
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
              if (itemDiscount.startDate.toDate && typeof itemDiscount.startDate.toDate === 'function') {
                itemDiscount.startDate = itemDiscount.startDate.toDate();
              } else if (typeof itemDiscount.startDate === 'string' || typeof itemDiscount.startDate === 'number') {
                const date = new Date(itemDiscount.startDate);
                itemDiscount.startDate = isNaN(date.getTime()) ? undefined : date;
              }
            }
            
            if (itemDiscount.endDate) {
              if (itemDiscount.endDate.toDate && typeof itemDiscount.endDate.toDate === 'function') {
                itemDiscount.endDate = itemDiscount.endDate.toDate();
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
      removeItem(item.id);
    } else {
      // Usa il prezzo finale: 0 se è un regalo, altrimenti il prezzo scontato
      const finalPrice = itemIsGift ? 0 : discountedPrice;
      
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
    <div className="card-premium rounded-xl overflow-hidden hover-lift group h-[600px] flex flex-col">
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
        
        {/* Gift Badge - positioned above image */}
        {itemIsGift && isAdded && (
          <div className="absolute top-3 left-3 bg-green-600 text-white px-3 py-2 rounded-full text-sm font-bold shadow-2xl border-2 border-white z-20 flex items-center space-x-1" style={{ backdropFilter: 'blur(4px)' }}>
            <Gift className="w-3 h-3" />
            <span>{giftSettings?.giftText || "OMAGGIO!"}</span>
          </div>
        )}
        
        {/* Free Badge - positioned above image (for discounted items) */}
        {!itemIsGift && discountedPrice === 0 && (
          <div className="absolute top-3 left-3 bg-green-600 text-white px-3 py-2 rounded-full text-sm font-bold shadow-2xl border-2 border-white z-20" style={{ backdropFilter: 'blur(4px)' }}>
            GRATIS
          </div>
        )}
        
        {/* Unavailable Overlay */}
        {!itemAvailable && (
          <div className="absolute inset-0 bg-gray-500/80 flex items-center justify-center z-30">
            <div className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold text-center max-w-[200px]">
              <div>Non Disponibile</div>
              <div className="text-xs mt-1 opacity-90 font-normal">
                {getUnavailableReason(item.id)}
              </div>
            </div>
          </div>
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
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    <div>include sconto globale</div>
                    {discounts?.global?.endDate && (
                      <div className="text-orange-600 font-medium">
                        scade: {(() => {
                          try {
                            let endDate: Date;
                            const rawDate = discounts.global.endDate;
                            
                            // Handle Firebase Timestamp
                            if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate && typeof rawDate.toDate === 'function') {
                              endDate = rawDate.toDate();
                            } 
                            // Handle Date object
                            else if (rawDate instanceof Date) {
                              endDate = rawDate;
                            } 
                            // Handle string or number
                            else if (rawDate) {
                              endDate = new Date(rawDate);
                            } else {
                              return 'data non valida';
                            }
                            
                            // Check if date is valid
                            if (isNaN(endDate.getTime())) {
                              return 'data non valida';
                            }
                            
                            return format(endDate, "d MMM", { locale: it });
                          } catch (error) {
                            console.error('Error formatting discount end date:', error);
                            return 'data non valida';
                          }
                        })()}
                      </div>
                    )}
                  </div>
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
