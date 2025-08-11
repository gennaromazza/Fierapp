import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Item, Discounts } from "@shared/schema";
import { useCart } from "../hooks/useCart";
import { calculateDiscountedPrice, calculateSeparateDiscounts, isDiscountActive } from "../lib/discounts";
import { Plus, Check, Clock, Gift } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";

interface ItemCardProps {
  item: Item;
}

export default function ItemCard({ item }: ItemCardProps) {
  const { addItem, removeItem, isInCart } = useCart();
  const [discounts, setDiscounts] = useState<Discounts | null>(null);
  const isAdded = isInCart(item.id);

  useEffect(() => {
    async function loadDiscounts() {
      try {
        const discountsDoc = await getDoc(doc(db, "settings", "discounts"));
        if (discountsDoc.exists()) {
          const discountsData = discountsDoc.data() as Discounts;
          setDiscounts(discountsData);
        } else {
          // Set default discount structure if document doesn't exist
          setDiscounts({
            global: { type: "percent", value: 0, isActive: false }
          });
        }
      } catch (error) {
        console.error("Error loading discounts:", error);
        // Set fallback discounts in case of error  
        setDiscounts({
          global: { type: "percent", value: 0, isActive: false }
        });
      }
    }

    loadDiscounts();
  }, [item.id]);

  const originalPrice = item.originalPrice || item.price;
  
  // Calculate separate discounts
  const discountInfo = discounts ? calculateSeparateDiscounts(originalPrice, item.id, discounts) : {
    itemDiscount: 0,
    globalDiscount: 0,
    finalPrice: originalPrice
  };
  
  const discountedPrice = discountInfo.finalPrice;
  const savings = originalPrice - discountedPrice;
  const discountPercent = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  
  // Determine if each type of discount is applied
  const hasGlobalDiscount = discountInfo.globalDiscount > 0;
  const hasItemSpecificDiscount = discountInfo.itemDiscount > 0;
  
  // Check if discount is active using the same logic as the calculation functions
  const hasActiveItemDiscount = discounts?.perItemOverrides?.[item.id] ? 
    isDiscountActive(discounts.perItemOverrides[item.id]) : false;
  const hasActiveGlobalDiscount = discounts?.global ? 
    isDiscountActive(discounts.global) : false;
  const hasAnyActiveDiscount = hasActiveItemDiscount || hasActiveGlobalDiscount;

  const handleToggle = () => {
    if (isAdded) {
      removeItem(item.id);
    } else {
      addItem({
        id: item.id,
        title: item.title,
        price: discountedPrice,
        originalPrice: originalPrice,
        imageUrl: item.imageUrl,
        category: item.category,
        globalDiscountApplied: hasGlobalDiscount,
        itemDiscountAmount: discountInfo.itemDiscount,
        globalDiscountAmount: discountInfo.globalDiscount,
      });
    }
  };

  return (
    <div className="card-premium rounded-xl overflow-hidden hover-lift group">
      {/* Image with discount badge */}
      <div className="relative">
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
        
        {/* Discount Badge */}
        {hasAnyActiveDiscount && discountPercent > 0 && (
          <div className="absolute top-3 left-3 bg-brand-accent text-white px-4 py-2 rounded-full text-sm font-bold shadow-glow">
            -{discountPercent}%
          </div>
        )}
        
        {/* Free Badge */}
        {discountedPrice === 0 && (
          <div className="absolute top-3 left-3 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-elegant">
            GRATIS
          </div>
        )}
        
        {/* Expiry Notice - show the earliest expiry date from active discounts */}
        {hasAnyActiveDiscount && (() => {
          const itemDiscount = discounts?.perItemOverrides?.[item.id];
          const globalDiscount = discounts?.global;
          
          let earliestExpiry: Date | null = null;
          
          if (itemDiscount?.endDate && hasActiveItemDiscount) {
            earliestExpiry = itemDiscount.endDate;
          }
          
          if (globalDiscount?.endDate && hasActiveGlobalDiscount) {
            if (!earliestExpiry || globalDiscount.endDate < earliestExpiry) {
              earliestExpiry = globalDiscount.endDate;
            }
          }
          
          return earliestExpiry ? (
            <div className="absolute top-3 right-3 glass text-gray-800 px-3 py-1 rounded-lg text-xs font-medium">
              <Clock className="w-3 h-3 inline mr-1" />
              <span>
                {format(earliestExpiry, "d MMM", { locale: it })}
              </span>
            </div>
          ) : null;
        })()}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-brand-accent mb-2">{item.title}</h3>
        {item.subtitle && (
          <p className="text-sm text-gray-500 mb-2">{item.subtitle}</p>
        )}
        {item.description && (
          <p className="text-gray-600 mb-4">{item.description}</p>
        )}
        
        {/* Price Display with Savings */}
        <div className="space-y-2 mb-4">
          {savings > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 line-through">
                €{originalPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-bold">
                Risparmi €{savings.toLocaleString('it-IT')}
              </span>
            </div>
          )}
          <div className={`text-2xl font-bold price-drop ${discountedPrice === 0 ? 'text-green-600' : 'text-brand-accent'}`}>
            {discountedPrice === 0 ? 'GRATIS' : `€${discountedPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          </div>
        </div>
        
        {/* Add/Remove Button */}
        <button
          onClick={handleToggle}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2 ${
            isAdded
              ? "bg-green-600 text-white hover:bg-green-700"
              : discountedPrice === 0
              ? "bg-green-600 text-white hover:bg-green-700"
              : "text-white hover:opacity-90"
          }`}
          style={!isAdded && discountedPrice !== 0 ? { backgroundColor: 'var(--brand-accent)' } : {}}
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
