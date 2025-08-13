import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Gift, Tag, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Discounts } from '@shared/schema';

interface InlinePriceDisplayProps {
  onCheckout?: () => void;
  showCheckoutButton?: boolean;
  className?: string;
}

export function InlinePriceDisplay({ onCheckout, showCheckoutButton = true, className }: InlinePriceDisplayProps) {
  const cart = useCartWithRules();
  const [discounts, setDiscounts] = useState<Discounts>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "discounts"),
      (doc) => {
        if (doc.exists()) {
          setDiscounts(doc.data() as Discounts);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  if (cart.cart.items.length === 0) {
    return (
      <div className={cn("text-center py-6", className)}>
        <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Nessun prodotto selezionato</p>
        <p className="text-sm text-gray-400">Inizia a scegliere i tuoi servizi!</p>
      </div>
    );
  }

  const subtotal = cart.cart.items.reduce((sum, item) => {
    return sum + (item.originalPrice || item.price);
  }, 0);

  const giftItems = cart.cart.items.filter(item => item.price === 0 && item.originalPrice);
  const giftSavings = giftItems.reduce((sum, item) => sum + (item.originalPrice || 0), 0);

  const finalTotal = cart.getPricingWithRules().finalTotal;
  const globalDiscount = discounts?.global?.isActive ? (discounts.global.value || 0) : 0;

  return (
    <div className={cn("bg-white border rounded-lg p-4 space-y-4", className)}>
      {/* Selected Items */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Prodotti Selezionati ({cart.cart.items.length})
        </h3>
        
        <div className="space-y-2">
          {cart.cart.items.map(item => (
            <div key={item.id} className="flex justify-between items-center py-1">
              <div className="flex-1">
                <span className="text-sm font-medium">{item.name}</span>
                {item.price === 0 && item.originalPrice && (
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 text-xs">
                    <Gift className="h-3 w-3 mr-1" />
                    GRATIS
                  </Badge>
                )}
              </div>
              <div className="text-right">
                {item.price === 0 && item.originalPrice ? (
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-green-600">GRATIS</span>
                    <span className="text-xs text-gray-500 line-through">€{item.originalPrice}</span>
                  </div>
                ) : (
                  <span className="text-sm font-medium">€{item.price}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotale:</span>
          <span>€{subtotal}</span>
        </div>
        
        {giftSavings > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span className="flex items-center gap-1">
              <Gift className="h-3 w-3" />
              Omaggi:
            </span>
            <span>-€{giftSavings}</span>
          </div>
        )}
        
        {globalDiscount > 0 && (
          <div className="flex justify-between text-sm text-blue-600">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Sconto Fiera:
            </span>
            <span>-€{globalDiscount}</span>
          </div>
        )}
        
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Totale:</span>
          <span className="text-blue-600">€{finalTotal}</span>
        </div>
        
        {(giftSavings > 0 || globalDiscount > 0) && (
          <div className="text-center">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <Sparkles className="h-3 w-3 mr-1" />
              Hai risparmiato €{subtotal - finalTotal}!
            </Badge>
          </div>
        )}
      </div>

      {/* Checkout Button */}
      {showCheckoutButton && onCheckout && (
        <Button 
          onClick={onCheckout}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          Procedi al Preventivo
        </Button>
      )}
    </div>
  );
}