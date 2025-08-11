import { useCart } from "../hooks/useCart";
import { ShoppingCart, MessageCircle } from "lucide-react";

interface PriceBarProps {
  onOpenCheckout?: () => void;
}

export default function PriceBar({ onOpenCheckout }: PriceBarProps) {
  const { cart } = useCart();

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
              <div className="flex-1">
                {/* Desktop view */}
                <div className="hidden sm:flex items-center space-x-3 text-sm">
                  <div className="text-gray-600">
                    Subtotale: <span className="font-semibold">€{cart.subtotal.toLocaleString('it-IT')}</span>
                  </div>
                  {cart.itemDiscount > 0 && (
                    <div className="text-green-600">
                      Sconto prodotto: <span className="font-bold">-€{cart.itemDiscount.toLocaleString('it-IT')}</span>
                    </div>
                  )}
                  {cart.globalDiscount > 0 && (
                    <div className="text-green-600">
                      Sconto globale: <span className="font-bold">-€{cart.globalDiscount.toLocaleString('it-IT')}</span>
                    </div>
                  )}
                </div>
                
                {/* Mobile view - compact */}
                <div className="sm:hidden text-xs">
                  <div className="text-gray-600 mb-1">
                    Subtotale: €{cart.subtotal.toLocaleString('it-IT')}
                  </div>
                  {(cart.itemDiscount > 0 || cart.globalDiscount > 0) && (
                    <div className="flex space-x-2 text-green-600">
                      {cart.itemDiscount > 0 && (
                        <span>Sconto prod.: -€{cart.itemDiscount.toLocaleString('it-IT')}</span>
                      )}
                      {cart.globalDiscount > 0 && (
                        <span>Sconto glob.: -€{cart.globalDiscount.toLocaleString('it-IT')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Total Price */}
              <div className="text-right">
                <div className="text-xs opacity-70 sm:hidden" style={{ color: 'var(--brand-accent)' }}>Totale</div>
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
