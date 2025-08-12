import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
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
    // Usa onSnapshot per aggiornamenti in tempo reale
    const unsubscribe = onSnapshot(doc(db, "settings", "discounts"), (discountsDoc) => {
      if (discountsDoc.exists()) {
        const discountsData = discountsDoc.data() as Discounts;

        setDiscounts(discountsData);
        
        // Salva nel localStorage per sync con useCartWithRules
        localStorage.setItem('cachedDiscounts', JSON.stringify(discountsData));
      } else {

        setDiscounts({});
        localStorage.removeItem('cachedDiscounts');
      }
    }, (error) => {
      console.error("Error loading discounts:", error);
    });

    return () => unsubscribe();
  }, []);

  // Calculate discount breakdown
  const calculateDiscountBreakdown = () => {
    let globalDiscount = 0;
    let itemSpecificDiscount = 0;

    // Controlla se c'è uno sconto globale attivo
    const hasGlobalDiscount = discounts?.global?.isActive;
    


    // Calcola lo sconto globale se attivo
    if (hasGlobalDiscount && discounts.global) {
      if (discounts.global.type === 'fixed') {
        // Sconto fisso
        globalDiscount = discounts.global.value || 0;
      } else if (discounts.global.type === 'percent') {
        // Sconto percentuale sul totale
        const subtotal = cart.cart.items.reduce((sum, item) => {
          if (item.price === 0) return sum; // Salta gli omaggi
          return sum + (item.originalPrice || item.price);
        }, 0);
        globalDiscount = Math.round(subtotal * ((discounts.global.value || 0) / 100));
      }
    }

    // Calcola gli sconti specifici per item
    cart.cart.items.forEach(item => {
      // Se è un regalo (price = 0), salta
      if (item.price === 0) return;

      const originalPrice = item.originalPrice || item.price;
      
      // Se l'item ha già uno sconto applicato (originalPrice > price), aggiungilo al totale sconti
      if (item.originalPrice && item.originalPrice > item.price) {
        itemSpecificDiscount += (item.originalPrice - item.price);
      }
      
      // Controlla anche se ci sono sconti configurati in discounts.perItemOverrides
      const hasItemDiscount = discounts?.perItemOverrides?.[item.id];
      if (hasItemDiscount && hasItemDiscount.isActive) {
        if (hasItemDiscount.type === 'fixed') {
          itemSpecificDiscount += (hasItemDiscount.value || 0);
        } else if (hasItemDiscount.type === 'percent') {
          const itemDiscountAmount = Math.round(originalPrice * ((hasItemDiscount.value || 0) / 100));
          itemSpecificDiscount += itemDiscountAmount;
        }
      }
    });


    return { globalDiscount, itemSpecificDiscount };
  };

  const { globalDiscount, itemSpecificDiscount } = calculateDiscountBreakdown();

  // Get pricing with rules applied
  const basePricing = cart.getPricingWithRules();
  
  // Calcola il subtotale originale (senza sconti globali)
  const originalSubtotal = cart.cart.items.reduce((sum, item) => {
    if (item.price === 0) return sum; // Salta gli omaggi
    return sum + (item.originalPrice || item.price);
  }, 0);
  
  const pricing = {
    subtotal: originalSubtotal,
    totalDiscountValue: globalDiscount + itemSpecificDiscount,
    total: Math.max(0, originalSubtotal - globalDiscount - itemSpecificDiscount)
  };

  if (cart.cart.itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 glass shadow-elegant border-t-2 z-40" style={{ borderColor: 'var(--brand-accent)' }}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-4">
        <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Cart Icon with Count */}
            <div className="relative flex-shrink-0 mt-1 sm:mt-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" style={{ color: 'var(--brand-accent)' }} />
              <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-glow text-[10px] sm:text-xs">
                {cart.cart.itemCount}
              </span>
            </div>

            {/* Price Details - Desktop */}
            <div className="hidden xl:block flex-1 min-w-0">
              <div className="space-y-1">
                {/* Lista prodotti nel carrello - Desktop with scroll if needed */}
                <div className="flex items-center gap-1 text-sm max-w-full overflow-x-auto scrollbar-hide">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    {cart.cart.items.map((item, index) => (
                      <span key={item.id} className="flex items-center flex-shrink-0">
                        <span className="text-gray-700 text-sm">
                          {item.title}
                          {item.price === 0 && (
                            <span className="ml-1 text-green-600 font-bold">(OMAGGIO)</span>
                          )}
                        </span>
                        {index < cart.cart.items.length - 1 && (
                          <span className="mx-1 text-gray-400">•</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                
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

            {/* Price Details - Large screens (lg to xl) */}
            <div className="hidden lg:block xl:hidden flex-1 min-w-0">
              <div className="space-y-1">
                {/* Lista prodotti compatta per lg */}
                <div className="text-xs text-gray-700 line-clamp-2">
                  <span className="font-medium">{cart.cart.itemCount} prodotti/servizi selezionati</span>
                </div>
                <div className="text-sm text-gray-700">
                  Totale: <span className="font-semibold">€{pricing.subtotal.toLocaleString('it-IT')}</span>
                </div>
                {pricing.totalDiscountValue > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {globalDiscount > 0 && (
                      <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs font-medium">
                        <Globe className="w-3 h-3 inline mr-1" />
                        -€{Math.round(globalDiscount).toLocaleString('it-IT')}
                      </div>
                    )}
                    {itemSpecificDiscount > 0 && (
                      <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs font-medium">
                        <Tag className="w-3 h-3 inline mr-1" />
                        -€{Math.round(itemSpecificDiscount).toLocaleString('it-IT')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Price Details - Tablet */}
            <div className="hidden sm:block lg:hidden flex-1 min-w-0">
              <div className="space-y-1">
                <div className="text-xs text-gray-700">
                  <span className="font-medium">{cart.cart.itemCount} elementi selezionati</span>
                </div>
                <div className="text-sm text-gray-700">
                  Totale: <span className="font-semibold">€{pricing.subtotal.toLocaleString('it-IT')}</span>
                </div>
                {pricing.totalDiscountValue > 0 && (
                  <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs text-center font-bold">
                    RISPARMIO: €{pricing.totalDiscountValue.toLocaleString('it-IT')}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Price Summary */}
            <div className="block sm:hidden flex-1 min-w-0">
              <div className="text-left">
                <div className="text-xs text-gray-600 mb-1 font-medium">
                  {cart.cart.itemCount} elementi
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  Totale: €{pricing.subtotal.toLocaleString('it-IT')}
                </div>
                {pricing.totalDiscountValue > 0 && (
                  <div className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
                    -€{pricing.totalDiscountValue.toLocaleString('it-IT')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total Price */}
          <div className="text-right flex-shrink-0">
            <div className="text-xs opacity-70 hidden sm:block" style={{ color: 'var(--brand-accent)' }}>Totale finale</div>
            <div className="text-xl sm:text-2xl font-bold text-brand-accent">
              €{pricing.total.toLocaleString('it-IT')}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onOpenCheckout}
            className="ml-2 sm:ml-4 btn-premium px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold flex items-center space-x-1 sm:space-x-2 min-w-fit flex-shrink-0"
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden md:inline text-sm sm:text-base">RICHIEDI INFO</span>
            <span className="md:hidden text-xs sm:text-sm">INFO</span>
          </button>
        </div>
      </div>
    </div>
  );
}