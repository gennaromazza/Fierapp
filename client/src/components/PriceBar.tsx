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

  // Usa esclusivamente il sistema di pricing unificato
  const pricing = cart.getPricingWithRules();

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
                <div className="flex items-center gap-2 text-base max-w-full overflow-x-auto scrollbar-hide">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    {cart.cart.items.map((item, index) => (
                      <span key={item.id} className="flex items-center flex-shrink-0">
                        <span className="text-gray-900 text-base font-medium">
                          {item.title}
                          {item.price === 0 && (
                            <span className="ml-2 text-green-600 font-bold text-sm px-2 py-1 bg-green-100 rounded-full">(OMAGGIO)</span>
                          )}
                        </span>
                        {index < cart.cart.items.length - 1 && (
                          <span className="mx-2 text-gray-500 font-bold">•</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Totale servizi/prodotti senza sconti */}
                <div className="flex items-center text-sm text-gray-700">
                  <span>Subtotale servizi/prodotti: </span>
                  <span className="font-semibold ml-1">€{pricing.subtotal.toLocaleString('it-IT')}</span>
                </div>

                {/* Sconti breakdown */}
                {pricing.totalSavings > 0 && (
                  <div className="space-y-1">
                    {pricing.detailed?.globalDiscountSavings > 0 && (
                      <div className="flex items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-md">
                        <Globe className="w-4 h-4 mr-2 text-green-600" />
                        <span className="text-green-800">Sconto globale (-10%): </span>
                        <span className="font-bold ml-1 text-green-700 text-lg">-€{pricing.detailed.globalDiscountSavings.toLocaleString('it-IT')}</span>
                      </div>
                    )}
                    {pricing.detailed?.individualDiscountSavings > 0 && (
                      <div className="flex items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-md">
                        <Tag className="w-4 h-4 mr-2 text-green-600" />
                        <span className="text-green-800">Sconti prodotti/servizi: </span>
                        <span className="font-bold ml-1 text-green-700 text-lg">-€{pricing.detailed.individualDiscountSavings.toLocaleString('it-IT')}</span>
                      </div>
                    )}
                    {pricing.detailed?.giftSavings > 0 && (
                      <div className="flex items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-md">
                        <Tag className="w-4 h-4 mr-2 text-green-600" />
                        <span className="text-green-800">Servizi in omaggio: </span>
                        <span className="font-bold ml-1 text-green-700 text-lg">-€{pricing.detailed.giftSavings.toLocaleString('it-IT')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Price Details - Large screens (lg to xl) */}
            <div className="hidden lg:block xl:hidden flex-1 min-w-0">
              <div className="space-y-1">
                {/* Lista prodotti compatta per lg con nomi */}
                <div className="text-xs text-gray-700 line-clamp-2 max-w-full overflow-hidden">
                  <span className="font-medium">{cart.cart.itemCount} prodotti: </span>
                  <span className="text-gray-600">
                    {cart.cart.items.map((item, index) => (
                      <span key={item.id}>
                        {item.title}
                        {item.price === 0 && <span className="text-green-600 font-bold"> (OMAGGIO)</span>}
                        {index < cart.cart.items.length - 1 && <span className="mx-1">•</span>}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  Totale: <span className="font-semibold">€{pricing.originalSubtotal.toLocaleString('it-IT')}</span>
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
                {/* Lista prodotti per tablet con nomi compatti */}
                <div className="text-xs text-gray-700 max-w-full overflow-hidden">
                  <span className="font-medium">{cart.cart.itemCount} prodotti: </span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {cart.cart.items.map((item, index) => (
                      <span key={item.id} className="inline-flex items-center">
                        <span className="text-gray-600 font-medium truncate max-w-20">
                          {item.title}
                        </span>
                        {item.price === 0 && (
                          <span className="ml-1 text-green-600 font-bold text-xs">(OMAGGIO)</span>
                        )}
                        {index < cart.cart.items.length - 1 && (
                          <span className="mx-1 text-gray-400">•</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  Totale: <span className="font-semibold">€{pricing.originalSubtotal.toLocaleString('it-IT')}</span>
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
                {/* Lista prodotti mobile compatta */}
                <div className="mb-1">
                  <div className="text-xs text-gray-700 font-medium">
                    {cart.cart.itemCount} prodotti • Totale: €{pricing.originalSubtotal.toLocaleString('it-IT')}
                  </div>
                  {/* Mostra solo i primi 2 prodotti + contatore */}
                  <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1 flex-wrap">
                    {cart.cart.items.slice(0, 2).map((item, index) => (
                      <span key={item.id} className="inline-flex items-center bg-gray-100 rounded px-1.5 py-0.5">
                        <span className="font-medium">
                          {item.title.length > 12 ? `${item.title.substring(0, 12)}...` : item.title}
                          {item.price === 0 && <span className="ml-1 text-green-600 font-bold">🎁</span>}
                        </span>
                      </span>
                    ))}
                    {cart.cart.items.length > 2 && (
                      <span className="bg-brand-accent text-white rounded px-1.5 py-0.5 text-xs font-bold">
                        +{cart.cart.items.length - 2}
                      </span>
                    )}
                  </div>
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