import { useState } from 'react';
import { Gift, Lock, Info, ChevronRight, Sparkles } from 'lucide-react';
import { useSelectionRules } from '../hooks/useSelectionRules';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Item } from '@shared/schema';

export default function RulesInfoPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { rules, loading: rulesLoading } = useSelectionRules();
  
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

  const giftRules = rules.filter(r => r.type === 'gift_transformation' && r.active);
  const availabilityRules = rules.filter(r => r.type === 'availability' && r.active);

  if (rulesLoading || (giftRules.length === 0 && availabilityRules.length === 0)) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-sm">
      {/* Bottone di apertura con animazione */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full px-4 py-3 shadow-xl flex items-center gap-2 hover:scale-105 transition-transform animate-pulse"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-bold">Scopri le Offerte Speciali!</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Pannello espandibile */}
      {isExpanded && (
        <div className="mt-2 bg-white rounded-xl shadow-2xl border-2 border-green-400 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 border-b">
            <h3 className="font-bold text-lg text-green-800 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Offerte e Regole Attive
            </h3>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Regole Regalo */}
            {giftRules.length > 0 && (
              <div>
                <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Prodotti in Omaggio
                </h4>
                {giftRules.map(rule => {
                  const requiredItems = rule.conditions.type === 'required_items' 
                    ? getItemNames(rule.conditions.requiredItems || []) 
                    : [];
                  const targetItems = getItemNames(rule.targetItems);
                  
                  return (
                    <div key={rule.id} className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="font-semibold text-green-800 mb-1">{rule.name}</div>
                      <div className="text-sm text-gray-700">
                        <div className="mb-1">
                          <span className="font-medium">Seleziona:</span>
                          <ul className="ml-4 mt-1">
                            {requiredItems.map((item, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <span className="text-green-600">✓</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-200">
                          <span className="text-green-600 font-bold">→ GRATIS:</span>
                          <span className="font-semibold">{targetItems.join(', ')}</span>
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
                <h4 className="font-bold text-orange-700 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Sblocca Prodotti
                </h4>
                {availabilityRules.map(rule => {
                  const requiredItems = rule.conditions.type === 'required_items' 
                    ? getItemNames(rule.conditions.requiredItems || []) 
                    : [];
                  const targetItems = getItemNames(rule.targetItems);
                  
                  return (
                    <div key={rule.id} className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                      <div className="font-semibold text-orange-800 mb-1">{rule.name}</div>
                      <div className="text-sm text-gray-700">
                        <div className="mb-1">
                          <span className="font-medium">Per sbloccare {targetItems.join(', ')}:</span>
                          <ul className="ml-4 mt-1">
                            {requiredItems.map((item, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <span className="text-orange-600">+</span> Aggiungi {item}
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

          <div className="bg-gray-50 p-3 border-t">
            <p className="text-xs text-gray-600 text-center">
              💡 Suggerimento: Combina i prodotti per ottenere omaggi esclusivi!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}