import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Gift, Lock, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { Item } from '@shared/schema';

interface ChatProductSelectorProps {
  category: 'servizio' | 'prodotto';
  onComplete?: () => void;
  showSavingsTips?: boolean;
}

export function ChatProductSelector({ category, onComplete, showSavingsTips = true }: ChatProductSelectorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const cart = useCartWithRules();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const itemsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Item))
          .filter(item => item.category === category && item.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        setItems(itemsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading items:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [category]);

  const handleItemClick = (item: Item) => {
    const isSelected = cart.cart.items.some(cartItem => cartItem.id === item.id);
    
    if (isSelected) {
      cart.removeFromCart(item.id);
    } else {
      cart.addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        description: item.description
      });
    }
  };

  const getItemStatus = (item: Item) => {
    const cartItem = cart.cart.items.find(cartItem => cartItem.id === item.id);
    const isSelected = !!cartItem;
    const isGift = cartItem?.price === 0 && cartItem?.originalPrice && cartItem.originalPrice > 0;
    const unavailableReason = cart.getUnavailableReason(item.id);
    
    return {
      isSelected,
      isGift,
      isUnavailable: !!unavailableReason,
      unavailableReason
    };
  };

  const selectedCount = items.filter(item => 
    cart.cart.items.some(cartItem => cartItem.id === item.id)
  ).length;

  const totalSavings = cart.getTotalSavings();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-2">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="h-20 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Savings Tips */}
      {showSavingsTips && selectedCount > 0 && totalSavings > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Ottimo! Stai risparmiando €{totalSavings.toFixed(2)}
            </p>
          </div>
          {category === 'servizio' && selectedCount === 2 && (
            <p className="text-xs text-green-700 mt-1">
              💡 Consiglio: Con entrambi i servizi sbloccherai prodotti esclusivi!
            </p>
          )}
        </motion.div>
      )}

      {/* Item Cards */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const status = getItemStatus(item);
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative rounded-lg border-2 transition-all cursor-pointer",
                status.isSelected && "border-blue-500 bg-blue-50",
                status.isUnavailable && "opacity-50 cursor-not-allowed",
                !status.isSelected && !status.isUnavailable && "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
              )}
              onClick={() => !status.isUnavailable && handleItemClick(item)}
            >
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{item.name}</h4>
                      {status.isGift && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <Gift className="w-3 h-3 mr-1" />
                          REGALO
                        </Badge>
                      )}
                    </div>
                    
                    {item.description && (
                      <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    )}
                    
                    {status.isUnavailable && status.unavailableReason && (
                      <div className="flex items-center gap-1 mt-2">
                        <Lock className="w-3 h-3 text-red-500" />
                        <p className="text-xs text-red-600">{status.unavailableReason}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      {status.isGift ? (
                        <div>
                          <span className="text-xs line-through text-gray-400">€{item.price}</span>
                          <span className="text-sm font-bold text-green-600 ml-2">GRATIS</span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold">€{item.price}</span>
                      )}
                    </div>
                    
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      status.isSelected 
                        ? "bg-blue-500 border-blue-500" 
                        : "border-gray-300"
                    )}>
                      {status.isSelected && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Special Offers for Products */}
                {category === 'prodotto' && item.name.includes('Album') && !status.isSelected && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Seleziona tutti gli album per un regalo speciale!
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Continue Button */}
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button 
            onClick={onComplete}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            Continua con {selectedCount} {category === 'servizio' ? 'servizi' : 'prodotti'} selezionati
          </Button>
        </motion.div>
      )}
    </div>
  );
}