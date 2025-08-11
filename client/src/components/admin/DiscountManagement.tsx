import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Discounts, Discount } from "@shared/schema";
import { useCollection } from "../../hooks/useFirestore";
import { Item } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Percent, Trash2, Plus, Save, Clock } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function DiscountManagement() {
  const { data: items, loading: itemsLoading } = useCollection<Item>("items");
  const { toast } = useToast();
  const [discounts, setDiscounts] = useState<Discounts>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global discount form
  const [globalDiscount, setGlobalDiscount] = useState<Partial<Discount>>({
    type: "percent",
    value: 0,
    isActive: false,
  });

  // Item-specific discounts
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, Partial<Discount>>>({});

  useEffect(() => {
    loadDiscounts();
  }, []);

  useEffect(() => {
    // Detect existing discounts from items when items are loaded
    if (items.length > 0 && !loading) {
      detectExistingItemDiscounts();
    }
  }, [items, loading]);

  const detectExistingItemDiscounts = () => {
    const detectedDiscounts: Record<string, Partial<Discount>> = { ...itemDiscounts };
    
    items.forEach(item => {
      // Only add if not already configured and has a discount
      if (!itemDiscounts[item.id] && !discounts.perItemOverrides?.[item.id] && 
          item.originalPrice && item.originalPrice > item.price) {
        
        const discountAmount = item.originalPrice - item.price;
        const discountPercent = Math.round((discountAmount / item.originalPrice) * 100);
        
        // Add detected discount
        detectedDiscounts[item.id] = {
          type: "percent",
          value: discountPercent,
          isActive: true
        };
      }
    });
    
    setItemDiscounts(detectedDiscounts);
  };

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      const discountsDoc = await getDoc(doc(db, "settings", "discounts"));
      if (discountsDoc.exists()) {
        const discountsData = discountsDoc.data() as Discounts;
        setDiscounts(discountsData);
        
        if (discountsData.global) {
          // Convert Firebase Timestamps to Date objects safely
          const globalDiscount = { ...discountsData.global };
          
          // Handle startDate conversion
          if (globalDiscount.startDate) {
            if (globalDiscount.startDate.toDate && typeof globalDiscount.startDate.toDate === 'function') {
              // Firebase Timestamp
              globalDiscount.startDate = globalDiscount.startDate.toDate();
            } else if (typeof globalDiscount.startDate === 'string' || typeof globalDiscount.startDate === 'number') {
              // String or number timestamp
              const date = new Date(globalDiscount.startDate);
              globalDiscount.startDate = isNaN(date.getTime()) ? undefined : date;
            } else if (!(globalDiscount.startDate instanceof Date)) {
              globalDiscount.startDate = undefined;
            }
          }
          
          // Handle endDate conversion
          if (globalDiscount.endDate) {
            if (globalDiscount.endDate.toDate && typeof globalDiscount.endDate.toDate === 'function') {
              // Firebase Timestamp
              globalDiscount.endDate = globalDiscount.endDate.toDate();
            } else if (typeof globalDiscount.endDate === 'string' || typeof globalDiscount.endDate === 'number') {
              // String or number timestamp
              const date = new Date(globalDiscount.endDate);
              globalDiscount.endDate = isNaN(date.getTime()) ? undefined : date;
            } else if (!(globalDiscount.endDate instanceof Date)) {
              globalDiscount.endDate = undefined;
            }
          }
          
          setGlobalDiscount(globalDiscount);
        }
        
        if (discountsData.perItemOverrides) {
          const itemDiscounts = { ...discountsData.perItemOverrides };
          // Convert all timestamps to Date objects safely
          Object.keys(itemDiscounts).forEach(key => {
            // Handle startDate
            if (itemDiscounts[key].startDate) {
              if (itemDiscounts[key].startDate.toDate && typeof itemDiscounts[key].startDate.toDate === 'function') {
                itemDiscounts[key].startDate = itemDiscounts[key].startDate.toDate();
              } else if (typeof itemDiscounts[key].startDate === 'string' || typeof itemDiscounts[key].startDate === 'number') {
                const date = new Date(itemDiscounts[key].startDate);
                itemDiscounts[key].startDate = isNaN(date.getTime()) ? undefined : date;
              } else if (!(itemDiscounts[key].startDate instanceof Date)) {
                itemDiscounts[key].startDate = undefined;
              }
            }
            
            // Handle endDate
            if (itemDiscounts[key].endDate) {
              if (itemDiscounts[key].endDate.toDate && typeof itemDiscounts[key].endDate.toDate === 'function') {
                itemDiscounts[key].endDate = itemDiscounts[key].endDate.toDate();
              } else if (typeof itemDiscounts[key].endDate === 'string' || typeof itemDiscounts[key].endDate === 'number') {
                const date = new Date(itemDiscounts[key].endDate);
                itemDiscounts[key].endDate = isNaN(date.getTime()) ? undefined : date;
              } else if (!(itemDiscounts[key].endDate instanceof Date)) {
                itemDiscounts[key].endDate = undefined;
              }
            }
          });
          setItemDiscounts(itemDiscounts);
        }
      }
    } catch (error) {
      console.error("Error loading discounts:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli sconti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveDiscounts = async () => {
    try {
      setSaving(true);
      
      const discountsData: Discounts = {
        global: globalDiscount.isActive && globalDiscount.value && globalDiscount.value > 0 ? globalDiscount as Discount : undefined,
      };

      await setDoc(doc(db, "settings", "discounts"), discountsData);
      setDiscounts(discountsData);
      
      toast({
        title: "Sconti salvati",
        description: "Le configurazioni degli sconti sono state salvate con successo",
      });
    } catch (error) {
      console.error("Error saving discounts:", error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio degli sconti",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateGlobalDiscount = (field: keyof Discount, value: any) => {
    setGlobalDiscount(prev => {
      const updated = { ...prev, [field]: value };
      // Reset value when switching discount type
      if (field === 'type') {
        updated.value = 0;
      }
      return updated;
    });
  };

  const updateItemDiscount = (itemId: string, field: keyof Discount, value: any) => {
    setItemDiscounts(prev => ({
      ...prev,
      [itemId]: { 
        ...prev[itemId], 
        [field]: value,
        // Reset value when switching discount type
        ...(field === 'type' ? { value: 0 } : {})
      }
    }));
  };

  const removeItemDiscount = (itemId: string) => {
    setItemDiscounts(prev => {
      const newDiscounts = { ...prev };
      delete newDiscounts[itemId];
      return newDiscounts;
    });
  };

  const addItemDiscount = (itemId: string) => {
    setItemDiscounts(prev => ({
      ...prev,
      [itemId]: { type: "percent", value: 0 }
    }));
  };

  const isDiscountExpired = (discount: Partial<Discount>) => {
    return discount.endDate ? isAfter(new Date(), discount.endDate) : false;
  };

  const isDiscountActive = (discount: Partial<Discount>) => {
    const now = new Date();
    if (discount.endDate && isAfter(now, discount.endDate)) return false;
    if (discount.startDate && isBefore(now, discount.startDate)) return false;
    return true;
  };

  const getDiscountStatus = (discount: Partial<Discount>) => {
    if (!discount.isActive || !discount.value || discount.value <= 0) return "inactive";
    if (isDiscountExpired(discount)) return "expired";
    if (!isDiscountActive(discount)) return "scheduled";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Attivo</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-800">Scaduto</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800">Programmato</Badge>;
      default:
        return <Badge variant="secondary">Inattivo</Badge>;
    }
  };

  if (loading || itemsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-8 shadow-2xl border border-white/20 backdrop-blur-lg" 
           style={{
             background: `linear-gradient(135deg, 
               var(--brand-accent) 0%, 
               rgba(var(--brand-accent-rgb, 18, 52, 88), 0.9) 50%, 
               rgba(var(--brand-secondary-rgb, 212, 201, 190), 0.3) 100%)`,
           }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                 style={{ 
                   background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(255,255,255,0.3)'
                 }}>
              <Percent className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-2xl">
                Gestione Sconti
              </h2>
              <p className="text-white/80 text-lg font-medium mt-1 drop-shadow-lg">
                Configura sconti globali e personalizzati
              </p>
            </div>
          </div>
          
          <Button
            onClick={saveDiscounts}
            disabled={saving}
            className="relative px-8 py-4 text-lg font-bold text-white rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl disabled:opacity-50 disabled:transform-none overflow-hidden group"
            style={{
              background: saving 
                ? 'linear-gradient(135deg, #6b7280, #9ca3af)' 
                : 'linear-gradient(135deg, #10b981, #059669, #047857)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)'
            }}
          >
            {/* Animated background for button */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>
            
            <div className="relative z-10 flex items-center">
              <Save className="w-5 h-5 mr-3" />
              {saving ? "Salvando..." : "Salva Configurazione"}
            </div>
          </Button>
        </div>
        
        {/* Decorative glow effect */}
        <div className="absolute inset-0 rounded-2xl shadow-inner" 
             style={{ 
               boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)' 
             }}></div>
      </div>

      <div className="space-y-6">

        <Card className="card-premium shadow-elegant">
          <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
            <CardTitle className="flex items-center space-x-2">
              <Percent className="w-5 h-5" style={{ color: 'var(--brand-accent)' }} />
              <span>Sconto Globale</span>
              {globalDiscount.value && globalDiscount.value > 0 && getStatusBadge(getDiscountStatus(globalDiscount))}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border">
              <input
                type="checkbox"
                id="global-discount-enabled"
                checked={globalDiscount.isActive || false}
                onChange={(e) => updateGlobalDiscount("isActive", e.target.checked)}
                className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent focus:ring-2"
              />
              <Label htmlFor="global-discount-enabled" className="text-sm font-medium">
                Abilita sconto globale
              </Label>
              <div className="ml-auto">
                {getStatusBadge(getDiscountStatus(globalDiscount))}
              </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-200 ${!globalDiscount.isActive ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <Label htmlFor="global-type">Tipo Sconto</Label>
                <Select
                  value={globalDiscount.type}
                  onValueChange={(value: "percent" | "fixed") => updateGlobalDiscount("type", value)}
                  disabled={!globalDiscount.isActive}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentuale (%)</SelectItem>
                    <SelectItem value="fixed">Importo Fisso (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="global-value">
                  Valore {globalDiscount.type === "percent" ? "(%)" : "(€)"}
                </Label>
                <Input
                  id="global-value"
                  type="number"
                  min={globalDiscount.isActive ? "0.01" : "0"}
                  max={globalDiscount.type === "percent" ? "100" : undefined}
                  step={globalDiscount.type === "percent" ? "1" : "0.01"}
                  value={globalDiscount.value || ""}
                  onChange={(e) => updateGlobalDiscount("value", parseFloat(e.target.value) || 0)}
                  placeholder={globalDiscount.isActive ? "Inserisci valore" : "Sconto disabilitato"}
                  disabled={!globalDiscount.isActive}
                />
                {globalDiscount.isActive && (!globalDiscount.value || globalDiscount.value <= 0) && (
                  <p className="text-sm text-red-600 mt-1">
                    Inserisci un valore maggiore di 0
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data Inizio (Opzionale)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !globalDiscount.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {globalDiscount.startDate && globalDiscount.startDate instanceof Date && !isNaN(globalDiscount.startDate.getTime()) ? (
                        format(globalDiscount.startDate, "dd/MM/yyyy", { locale: it })
                      ) : (
                        "Seleziona data"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={globalDiscount.startDate}
                      onSelect={(date) => updateGlobalDiscount("startDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Data Fine (Opzionale)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !globalDiscount.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {globalDiscount.endDate && globalDiscount.endDate instanceof Date && !isNaN(globalDiscount.endDate.getTime()) ? (
                        format(globalDiscount.endDate, "dd/MM/yyyy", { locale: it })
                      ) : (
                        "Seleziona data"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={globalDiscount.endDate}
                      onSelect={(date) => updateGlobalDiscount("endDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {globalDiscount.endDate && globalDiscount.endDate instanceof Date && !isNaN(globalDiscount.endDate.getTime()) && isDiscountExpired(globalDiscount) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-red-700">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Sconto Scaduto</span>
                </div>
                <p className="text-red-600 text-sm mt-1">
                  Questo sconto è scaduto il {format(globalDiscount.endDate, "dd/MM/yyyy", { locale: it })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
