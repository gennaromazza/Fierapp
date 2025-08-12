import { useState, useEffect, useRef } from 'react';
import { Gift, Lock, Info, ChevronRight, Sparkles, X } from 'lucide-react';
import { useSelectionRules } from '../hooks/useSelectionRules';
import { useCartWithRules } from '../hooks/useCartWithRules';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../hooks/use-toast';
import type { Item } from '@shared/schema';

export default function RulesInfoPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { rules, loading: rulesLoading } = useSelectionRules();
  const { cart, rulesEvaluation, getAllItemsWithAvailability } = useCartWithRules();
  const { toast } = useToast();
  
  // Ref per tracciare lo stato precedente delle regole
  const previousRulesStateRef = useRef<{
    availableItems: Set<string>;
    giftItems: Set<string>;
  }>({
    availableItems: new Set(),
    giftItems: new Set(),
  });
  
  // Carica gli items per mostrare i nomi
  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const itemsQuery = query(collection(db, 'items'), where('active', '==', true));
      const snapshot = await getDocs(itemsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
    }
  });

  const getItemNames = (itemIds: string[]) => {
    return itemIds.map(id => {
      const item = items.find(i => i.id === id);
      return item?.title || 'Prodotto';
    });
  };

  // Monitora i cambiamenti nelle regole e mostra toast
  useEffect(() => {
    if (rulesLoading || !items.length) return;

    const currentState = {
      availableItems: new Set<string>(),
      giftItems: new Set<string>(),
    };

    // Costruisci lo stato corrente
    Object.entries(rulesEvaluation.itemStates).forEach(([itemId, state]) => {
      if (state.isAvailable) {
        currentState.availableItems.add(itemId);
      }
      if (state.isGift) {
        currentState.giftItems.add(itemId);
      }
    });

    const previousState = previousRulesStateRef.current;

    // Trova nuovi item sbloccati
    const newlyAvailableItems = [...currentState.availableItems].filter(
      itemId => !previousState.availableItems.has(itemId) && 
      // Solo se l'item non è nel carrello (altrimenti è stato aggiunto manualmente)
      !cart.items.some(cartItem => cartItem.id === itemId)
    );

    // Trova nuovi item omaggio
    const newlyGiftItems = [...currentState.giftItems].filter(
      itemId => !previousState.giftItems.has(itemId)
    );

    // Mostra toast per item sbloccati
    newlyAvailableItems.forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        toast({
          title: "🎉 Prodotto Sbloccato!",
          description: `Hai sbloccato: ${item.title}`,
          duration: 4000,
        });
      }
    });

    // Mostra toast per item omaggio
    newlyGiftItems.forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        toast({
          title: "🎁 Omaggio Attivato!",
          description: `${item.title} è ora gratuito!`,
          duration: 4000,
        });
      }
    });

    // Aggiorna il riferimento allo stato precedente
    previousRulesStateRef.current = currentState;

  }, [rulesEvaluation, cart.items, items, rulesLoading, toast]);

  const giftRules = rules.filter(r => r.type === 'gift_transformation' && r.active);
  const availabilityRules = rules.filter(r => r.type === 'availability' && r.active);

  if (rulesLoading || (giftRules.length === 0 && availabilityRules.length === 0)) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-2 md:right-4 z-40 w-[calc(100vw-1rem)] max-w-sm">
      {/* Bottone di apertura con animazione */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full px-3 md:px-4 py-2 md:py-3 shadow-xl flex items-center gap-2 hover:scale-105 transition-transform animate-pulse w-full md:w-auto justify-center"
      >
        <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
        <span className="font-bold text-sm md:text-base">Scopri le Offerte Speciali!</span>
        <ChevronRight className={`w-3 h-3 md:w-4 md:h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Pannello espandibile */}
      {isExpanded && (
        <div className="mt-2 bg-white rounded-xl shadow-2xl border-2 border-green-400 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 md:p-4 border-b relative">
            <h3 className="font-bold text-base md:text-lg text-green-800 flex items-center gap-2 pr-8">
              <Info className="w-4 h-4 md:w-5 md:h-5" />
              Offerte e Regole Attive
            </h3>
            {/* Bottone X di chiusura */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 md:top-3 md:right-3 p-1 rounded-full hover:bg-green-100 transition-colors text-green-600 hover:text-green-800"
              aria-label="Chiudi pannello"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          <div className="p-3 md:p-4 space-y-3 md:space-y-4 max-h-[60vh] md:max-h-96 overflow-y-auto">
            {/* Regole Regalo */}
            {giftRules.length > 0 && (
              <div>
                <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2 text-sm md:text-base">
                  <Gift className="w-4 h-4" />
                  Prodotti in Omaggio
                </h4>
                {giftRules.map(rule => {
                  const requiredItems = rule.conditions.type === 'required_items' 
                    ? getItemNames(rule.conditions.requiredItems || []) 
                    : [];
                  const targetItems = getItemNames(rule.targetItems);
                  
                  return (
                    <div key={rule.id} className="bg-green-50 rounded-lg p-2 md:p-3 border border-green-200">
                      <div className="font-semibold text-green-800 mb-1 text-sm md:text-base">{rule.name}</div>
                      <div className="text-xs md:text-sm text-gray-700">
                        <div className="mb-1">
                          <span className="font-medium">Seleziona:</span>
                          <ul className="ml-3 md:ml-4 mt-1 space-y-0.5">
                            {requiredItems.map((item, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-green-600 flex-shrink-0 mt-0.5">✓</span> 
                                <span className="break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-green-200">
                          <span className="text-green-600 font-bold flex-shrink-0">→ GRATIS:</span>
                          <span className="font-semibold break-words">{targetItems.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Regole Disponibilità */}
            {availabilityRules.length > 0 && (
              <div>
                <h4 className="font-bold text-orange-700 mb-2 flex items-center gap-2 text-sm md:text-base">
                  <Lock className="w-4 h-4" />
                  Sblocca Prodotti
                </h4>
                {availabilityRules.map(rule => {
                  const requiredItems = rule.conditions.type === 'required_items' 
                    ? getItemNames(rule.conditions.requiredItems || []) 
                    : [];
                  const targetItems = getItemNames(rule.targetItems);
                  
                  return (
                    <div key={rule.id} className="bg-orange-50 rounded-lg p-2 md:p-3 border border-orange-200">
                      <div className="font-semibold text-orange-800 mb-1 text-sm md:text-base">{rule.name}</div>
                      <div className="text-xs md:text-sm text-gray-700">
                        <div className="mb-1">
                          <span className="font-medium break-words">Per sbloccare {targetItems.join(', ')}:</span>
                          <ul className="ml-3 md:ml-4 mt-1 space-y-0.5">
                            {requiredItems.map((item, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-orange-600 flex-shrink-0 mt-0.5">+</span> 
                                <span className="break-words">Aggiungi {item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-2 md:p-3 border-t">
            <p className="text-xs text-gray-600 text-center leading-relaxed">
              💡 Suggerimento: Combina i prodotti per ottenere omaggi esclusivi!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}