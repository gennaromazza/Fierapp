import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCart } from "../hooks/useCart";
import { Discounts } from "@shared/schema";
import { calculateDiscountedPrice } from "../lib/discounts";
import { ShoppingCart, MessageCircle, Tag, Globe } from "lucide-react";

interface PriceBarProps {
  onOpenCheckout?: () => void;
}

export default function PriceBar({ onOpenCheckout }: PriceBarProps) {
  const { cart } = useCart();
  const [discounts, setDiscounts] = useState<Discounts>({});

  useEffect(() => {
    const loadDiscounts = async () => {
      try {
        const discountsDoc = await getDoc(doc(db, "settings", "discounts"));
        if (discountsDoc.exists()) {
          setDiscounts(discountsDoc.data() as Discounts);
        }
      } catch (error) {
        console.error("Error loading discounts:", error);
      }
    };
    
    loadDiscounts();
  }, []);

  // Calculate discount breakdown
  const calculateDiscountBreakdown = () => {
    let globalDiscount = 0;
    let itemSpecificDiscount = 0;

    cart.items.forEach(item => {
      const originalPrice = item.originalPrice || item.price;
      const currentPrice = item.price;
      const totalItemDiscount = originalPrice - currentPrice;

      // Check if this item has a specific discount
      const hasItemDiscount = discounts.perItemOverrides?.[item.id];
      
      if (hasItemDiscount && totalItemDiscount > 0) {
        // Calculate what portion is from item-specific vs global
        const itemOnlyPrice = calculateDiscountedPrice(originalPrice, item.id, { perItemOverrides: { [item.id]: hasItemDiscount } });
        const itemSpecificAmount = originalPrice - itemOnlyPrice;
        const globalAmount = totalItemDiscount - itemSpecificAmount;
        
        itemSpecificDiscount += itemSpecificAmount;
        globalDiscount += globalAmount;
      } else if (discounts.global && totalItemDiscount > 0) {
        // All discount is from global
        globalDiscount += totalItemDiscount;
      }
    });

    return { globalDiscount, itemSpecificDiscount };
  };

  const { globalDiscount, itemSpecificDiscount } = calculateDiscountBreakdown();

  if (cart.itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 glass shadow-elegant border-t-2 z-40" style={{ borderColor: 'var(--brand-accent)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Price Breakdown */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-4">
              {/* Cart Icon with Count */}
              <div className="relative animate-float">
                <ShoppingCart className="w-7 h-7" style={{ color: 'var(--brand-accent)' }} />
                <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-glow">
                  {cart.itemCount}
                </span>
              </div>
              
              {/* Price Details */}
              <div className="hidden sm:block">
                <div className="space-y-1">
                  {/* Totale servizi/prodotti senza sconti */}
                  <div className="flex items-center text-sm text-gray-700">
                    <span>Totale servizi/prodotti: </span>
                    <span className="font-semibold ml-1">€{cart.subtotal.toLocaleString('it-IT')}</span>
                  </div>
                  
                  {/* Sconti breakdown */}
                  {cart.discount > 0 && (
                    <div className="space-y-1">
                      {globalDiscount > 0 && (
                        <div className="flex items-center text-sm text-green-700">
                          <Globe className="w-3 h-3 mr-1" />
                          <span>Sconto globale: </span>
                          <span className="font-bold ml-1">-€{Math.round(globalDiscount).toLocaleString('it-IT')}</span>
                          {discounts?.global?.endDate && (
                            <span className="text-xs text-green-600 ml-1">
                              (fino al {(() => {
                                try {
                                  let endDate: Date;
                                  if (discounts.global.endDate && typeof discounts.global.endDate === 'object' && 'toDate' in discounts.global.endDate) {
                                    endDate = (discounts.global.endDate as any).toDate();
                                  } else if (discounts.global.endDate instanceof Date) {
                                    endDate = discounts.global.endDate;
                                  } else {
                                    endDate = new Date(discounts.global.endDate);
                                  }
                                  return endDate.toLocaleDateString('it-IT');
                                } catch {
                                  return 'data non valida';
                                }
                              })()})
                            </span>
                          )}
                        </div>
                      )}
                      {itemSpecificDiscount > 0 && (
                        <div className="flex items-center text-sm text-green-700">
                          <Tag className="w-3 h-3 mr-1" />
                          <span>Sconti prodotti/servizi: </span>
                          <span className="font-bold ml-1">-€{Math.round(itemSpecificDiscount).toLocaleString('it-IT')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Mobile Price Summary */}
              <div className="block sm:hidden text-right">
                <div className="text-xs space-y-0.5" style={{ color: 'var(--brand-accent)' }}>
                  <div>Totale: €{cart.subtotal.toLocaleString('it-IT')}</div>
                  {cart.discount > 0 && (
                    <div className="text-green-600">Sconto: -€{cart.discount.toLocaleString('it-IT')}</div>
                  )}
                </div>
              </div>

              {/* Total Price */}
              <div className="text-right">
                <div className="text-xs opacity-70 hidden sm:block" style={{ color: 'var(--brand-accent)' }}>Totale finale</div>
                <div className="text-2xl font-bold text-brand-accent">
                  €{cart.total.toLocaleString('it-IT')}
                </div>
              </div>
            </div>
          </div>
          
          {/* CTA Button */}
          <button
            onClick={onOpenCheckout}
            className="ml-4 btn-premium px-6 py-3 rounded-lg font-bold flex items-center space-x-2 min-w-fit"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline">RICHIEDI INFO</span>
            <span className="sm:hidden">INFO</span>
          </button>
        </div>
      </div>
    </div>
  );
}
