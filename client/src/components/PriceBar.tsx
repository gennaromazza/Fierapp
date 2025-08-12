import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCartWithRules } from "../hooks/useCartWithRules";
import { Discounts } from "@shared/schema";
import { calculateDiscountedPrice } from "../lib/discounts";
import { ShoppingCart, MessageCircle, Tag, Globe } from "lucide-react";

interface PriceBarProps {
  onOpenCheckout?: () => void;
}

export default function PriceBar({ onOpenCheckout }: PriceBarProps) {
  const cart = useCartWithRules();
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

  // Get pricing with rules applied
  const pricing = cart.getPricingWithRules();

  // Calculate discount breakdown
  const calculateDiscountBreakdown = () => {
    let globalDiscount = 0;
    let itemSpecificDiscount = 0;

    cart.cart.items.forEach(item => {
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

  if (cart.cart.itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 glass shadow-elegant border-t-2 z-40" style={{ borderColor: 'var(--brand-accent)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Cart Icon with Count */}
            <div className="relative flex-shrink-0">
              <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: 'var(--brand-accent)' }} />
              <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-glow">
                {cart.cart.itemCount}
              </span>
            </div>

            {/* Price Details - Desktop */}
            <div className="hidden lg:block">
              <div className="space-y-1">
                {/* Totale servizi/prodotti senza sconti */}
                <div className="flex items-center text-sm text-gray-700">
                  <span>Totale servizi/prodotti: </span>
                  <span className="font-semibold ml-1">€{pricing.subtotal.toLocaleString('it-IT')}</span>
                </div>

                {/* Sconti breakdown */}
                {pricing.totalDiscountValue > 0 && (
                  <div className="space-y-1">
                    {globalDiscount > 0 && (
                      <div className="flex items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-md">
                        <Globe className="w-4 h-4 mr-2 text-green-600" />
                        <span className="text-green-800">Sconto globale: </span>
                        <span className="font-bold ml-1 text-green-700 text-lg">-€{Math.round(globalDiscount).toLocaleString('it-IT')}</span>
                        {discounts?.global?.endDate && (
                          <span className="text-xs text-green-600 ml-2 bg-green-100 px-2 py-1 rounded-full">
                            fino al {(() => {
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
                            })()}
                          </span>
                        )}
                      </div>
                    )}
                    {itemSpecificDiscount > 0 && (
                      <div className="flex items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-md">
                        <Tag className="w-4 h-4 mr-2 text-green-600" />
                        <span className="text-green-800">Sconti prodotti/servizi: </span>
                        <span className="font-bold ml-1 text-green-700 text-lg">-€{Math.round(itemSpecificDiscount).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Price Details - Tablet */}
            <div className="hidden sm:block lg:hidden">
              <div className="space-y-1">
                <div className="text-sm text-gray-700">
                  Totale: <span className="font-semibold">€{pricing.subtotal.toLocaleString('it-IT')}</span>
                </div>
                {pricing.totalDiscountValue > 0 && (
                  <div className="flex items-center space-x-2">
                    {globalDiscount > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
                        <Globe className="w-3 h-3 inline mr-1 text-green-600" />
                        <span className="text-green-800">-€{Math.round(globalDiscount).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                    {itemSpecificDiscount > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
                        <Tag className="w-3 h-3 inline mr-1 text-green-600" />
                        <span className="text-green-800">-€{Math.round(itemSpecificDiscount).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Price Summary */}
            <div className="block sm:hidden">
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">
                  Subtotale: €{pricing.subtotal.toLocaleString('it-IT')}
                </div>
                {pricing.totalDiscountValue > 0 && (
                  <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg mb-1">
                    RISPARMIO: €{pricing.totalDiscountValue.toLocaleString('it-IT')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total Price */}
          <div className="text-right">
            <div className="text-xs opacity-70 hidden sm:block" style={{ color: 'var(--brand-accent)' }}>Totale finale</div>
            <div className="text-2xl font-bold text-brand-accent">
              €{pricing.total.toLocaleString('it-IT')}
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