import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Minus, Gift, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item } from '@shared/schema';

interface InlineProductSelectorProps {
  category: 'servizio' | 'prodotto';
  onSelectionChange?: (selectedItems: Item[]) => void;
  className?: string;
}

export function InlineProductSelector({ category, onSelectionChange, className }: InlineProductSelectorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const cart = useCartWithRules();

  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        
        // Use same query logic as Carousel
        const itemsQuery = query(
          collection(db, "items"),
          where("active", "==", true),
          where("category", "==", category)
        );
        
        const snapshot = await getDocs(itemsQuery);
        let itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Item[];
        
        // Sort manually by sortOrder 
        itemsData.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        console.log(`📦 Inline loaded ${itemsData.length} ${category} items:`, itemsData.map(i => i.title));
        setItems(itemsData);
        setLoading(false);
        
      } catch (error) {
        console.error(`Error loading ${category} items:`, error);
        setLoading(false);
      }
    }
    
    loadItems();
  }, [category]);

  const handleItemClick = (item: Item) => {
    const isSelected = cart.cart.items.some(cartItem => cartItem.id === item.id);
    
    if (isSelected) {
      cart.removeItem(item.id);
    } else {
      // Controlla disponibilità prima di aggiungere
      const isAvailable = cart.isItemAvailable(item.id);
      if (!isAvailable) {
        const reason = cart.getUnavailableReason(item.id);
        console.warn(`Item ${item.title} non disponibile: ${reason}`);
        return;
      }

      const success = cart.addItem({
        id: item.id,
        title: item.title,
        price: item.price,
        category: item.category
      });
      
      if (!success) {
        console.warn(`Impossibile aggiungere ${item.title}`);
        return;
      }
    }

    // Notify parent of selection change
    setTimeout(() => {
      const selectedItems = items.filter(i => 
        cart.cart.items.some(cartItem => cartItem.id === i.id)
      );
      onSelectionChange?.(selectedItems);
    }, 100);
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
      unavailableReason,
      displayPrice: cartItem?.price ?? item.price,
      originalPrice: cartItem?.originalPrice ?? item.price
    };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map(item => {
        const status = getItemStatus(item);
        
        return (
          <div
            key={item.id}
            className={cn(
              "border rounded-lg p-4 transition-all cursor-pointer",
              status.isSelected 
                ? "border-blue-500 bg-blue-50" 
                : status.isUnavailable
                  ? "border-gray-200 bg-gray-50 opacity-60"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-md",
              status.isUnavailable && "cursor-not-allowed"
            )}
            onClick={() => !status.isUnavailable && handleItemClick(item)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={cn(
                    "font-medium",
                    status.isUnavailable ? "text-gray-400" : "text-gray-900"
                  )}>
                    {item.title}
                  </h4>
                  
                  {status.isSelected && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                  
                  {status.isGift && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      <Gift className="h-3 w-3 mr-1" />
                      GRATIS
                    </Badge>
                  )}
                  
                  {status.isUnavailable && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Bloccato
                    </Badge>
                  )}
                </div>
                
                {item.description && (
                  <p className={cn(
                    "text-sm mb-2",
                    status.isUnavailable ? "text-gray-400" : "text-gray-600"
                  )}>
                    {item.description}
                  </p>
                )}
                
                {status.isUnavailable && status.unavailableReason && (
                  <p className="text-xs text-red-500 italic">
                    {status.unavailableReason}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  {status.isGift ? (
                    <div>
                      <span className="text-lg font-bold text-green-600">GRATIS</span>
                      <div className="text-sm text-gray-500 line-through">
                        €{status.originalPrice}
                      </div>
                    </div>
                  ) : (
                    <span className={cn(
                      "text-lg font-bold",
                      status.isUnavailable ? "text-gray-400" : "text-gray-900"
                    )}>
                      €{status.displayPrice}
                    </span>
                  )}
                </div>
                
                {!status.isUnavailable && (
                  <Button
                    size="sm"
                    variant={status.isSelected ? "default" : "outline"}
                    className="min-w-[80px]"
                  >
                    {status.isSelected ? (
                      <>
                        <Minus className="h-3 w-3 mr-1" />
                        Rimuovi
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        Aggiungi
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}