import { useCart } from "../hooks/useCart";
import { ShoppingCart, MessageCircle } from "lucide-react";

interface PriceBarProps {
  onOpenCheckout?: () => void;
}

export default function PriceBar({ onOpenCheckout }: PriceBarProps) {
  const { cart } = useCart();

  if (cart.itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-brand-secondary shadow-2xl z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Price Breakdown */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-4">
              {/* Cart Icon with Count */}
              <div className="relative">
                <ShoppingCart className="w-6 h-6 text-brand-accent" />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.itemCount}
                </span>
              </div>
              
              {/* Price Details */}
              <div className="hidden sm:block">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-gray-600">
                    Subtotale: <span className="font-semibold">€{cart.subtotal.toLocaleString('it-IT')}</span>
                  </div>
                  {cart.discount > 0 && (
                    <div className="text-green-600">
                      Sconto: <span className="font-bold animate-counter">-€{cart.discount.toLocaleString('it-IT')}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Total Price */}
              <div className="text-right">
                <div className="text-xs text-gray-500 sm:hidden">Totale</div>
                <div className="text-xl font-bold text-brand-accent">
                  €{cart.total.toLocaleString('it-IT')}
                </div>
              </div>
            </div>
          </div>
          
          {/* CTA Button */}
          <button
            onClick={onOpenCheckout}
            className="ml-4 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 min-w-fit"
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
