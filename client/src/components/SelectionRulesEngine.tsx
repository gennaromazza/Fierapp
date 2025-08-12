import React from 'react';
import { useCartWithRules } from '../hooks/useCartWithRules';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Gift, Lock, CheckCircle } from 'lucide-react';

interface SelectionRulesEngineProps {
  children: React.ReactNode;
  showDebugInfo?: boolean;
}

/**
 * Componente motore delle regole di selezione
 * Wrappa il contenuto figlio e applica automaticamente le regole
 * Mostra feedback visivo sulle regole applicate
 */
export function SelectionRulesEngine({ 
  children, 
  showDebugInfo = false 
}: SelectionRulesEngineProps) {
  const {
    rulesEvaluation,
    appliedRules,
    rulesLoading,
    getDebugInfo
  } = useCartWithRules();

  // Informazioni di debug (solo in development)
  const debugInfo = showDebugInfo && process.env.NODE_ENV === 'development' 
    ? getDebugInfo?.() 
    : null;

  return (
    <div className="relative">
      {/* Contenuto principale */}
      {children}
      
      {/* Indicatori regole applicate */}
      {appliedRules.length > 0 && (
        <div className="mt-4">
          <RulesIndicator appliedRulesCount={appliedRules.length} />
        </div>
      )}
      
      {/* Debug panel (solo in development) */}
      {debugInfo && showDebugInfo && (
        <div className="mt-6">
          <DebugPanel debugInfo={debugInfo} rulesEvaluation={rulesEvaluation} />
        </div>
      )}
    </div>
  );
}

// Componente per mostrare indicatori delle regole applicate
function RulesIndicator({ appliedRulesCount }: { appliedRulesCount: number }) {
  return (
    <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
      <CardContent className="pt-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800 dark:text-green-300">
            {appliedRulesCount} regola{appliedRulesCount !== 1 ? 'e' : ''} di selezione attiv{appliedRulesCount !== 1 ? 'e' : 'a'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Panel di debug per sviluppo
function DebugPanel({ 
  debugInfo, 
  rulesEvaluation 
}: { 
  debugInfo: any; 
  rulesEvaluation: any; 
}) {
  return (
    <Card className="border-dashed border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
      <CardContent className="pt-4">
        <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-3">
          Debug: Rules Engine
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* Statistiche regole */}
          <div>
            <h5 className="font-medium mb-2">Rules Stats</h5>
            <ul className="space-y-1 text-xs">
              <li>Total Rules: {debugInfo.totalRules}</li>
              <li>Active Rules: {debugInfo.activeRules}</li>
              <li>Applied Rules: {rulesEvaluation.appliedRules.length}</li>
            </ul>
          </div>
          
          {/* Condizioni valutate */}
          <div>
            <h5 className="font-medium mb-2">Evaluated Conditions</h5>
            <div className="space-y-1">
              {debugInfo.evaluatedConditions.map((condition: any, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Badge 
                    variant={condition.conditionMet ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {condition.conditionMet ? "✓" : "✗"}
                  </Badge>
                  <span className="text-xs truncate">
                    {condition.ruleName} ({condition.conditionType})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componenti di utilità per mostrare stati item

/**
 * Badge per item non disponibile
 */
export function UnavailableBadge() {
  return (
    <Badge variant="destructive" className="flex items-center space-x-1">
      <Lock className="w-3 h-3" />
      <span>Non disponibile</span>
    </Badge>
  );
}

/**
 * Badge per item omaggio
 */
export function GiftBadge({ giftText = "OMAGGIO!" }: { giftText?: string }) {
  return (
    <Badge className="flex items-center space-x-1 bg-green-600 hover:bg-green-700">
      <Gift className="w-3 h-3" />
      <span>{giftText}</span>
    </Badge>
  );
}

/**
 * Componente per mostrare prezzo con supporto omaggio
 */
export function PriceWithGift({ 
  originalPrice, 
  isGift, 
  giftSettings 
}: { 
  originalPrice: number;
  isGift: boolean;
  giftSettings?: any;
}) {
  if (isGift) {
    return (
      <div className="space-y-1">
        {giftSettings?.showOriginalPrice && (
          <div className="text-sm text-gray-500 line-through">
            €{originalPrice.toLocaleString('it-IT')}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <span className="text-lg font-bold text-green-600">GRATIS</span>
          <GiftBadge giftText={giftSettings?.giftText} />
        </div>
      </div>
    );
  }
  
  return (
    <div className="text-lg font-bold">
      €{originalPrice.toLocaleString('it-IT')}
    </div>
  );
}