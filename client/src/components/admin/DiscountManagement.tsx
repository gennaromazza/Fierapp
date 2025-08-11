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
    isActive: true,
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
        global: globalDiscount.value && globalDiscount.value > 0 ? globalDiscount as Discount : undefined,
        perItemOverrides: Object.fromEntries(
          Object.entries(itemDiscounts).filter(([_, discount]) => discount.value && discount.value > 0)
        ) as Record<string, Discount>,
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
    if (!discount.value || discount.value <= 0) return "inactive";
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
      <div className="flex items-center justify-between glass rounded-xl p-6 shadow-elegant">
        <h2 className="text-3xl font-bold text-gradient">Gestione Sconti</h2>
        <Button
          onClick={saveDiscounts}
          disabled={saving}
          className="btn-premium animate-pulse-shadow"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salva Configurazione"}
        </Button>
      </div>

      <Tabs defaultValue="global" className="space-y-6">
        <TabsList className="glass rounded-xl p-2 shadow-elegant">
          <TabsTrigger value="global" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Sconto Globale</TabsTrigger>
          <TabsTrigger value="items" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Sconti per Item</TabsTrigger>
          <TabsTrigger value="overview" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Panoramica</TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
              <CardTitle className="flex items-center space-x-2">
                <Percent className="w-5 h-5" style={{ color: 'var(--brand-accent)' }} />
                <span>Sconto Globale</span>
                {globalDiscount.value && globalDiscount.value > 0 && getStatusBadge(getDiscountStatus(globalDiscount))}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="global-type">Tipo Sconto</Label>
                  <Select
                    value={globalDiscount.type}
                    onValueChange={(value: "percent" | "fixed") => updateGlobalDiscount("type", value)}
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
                    min="0"
                    max={globalDiscount.type === "percent" ? "100" : undefined}
                    step={globalDiscount.type === "percent" ? "1" : "0.01"}
                    value={globalDiscount.value || ""}
                    onChange={(e) => updateGlobalDiscount("value", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Stato</Label>
                  <div className="mt-2">
                    {getStatusBadge(getDiscountStatus(globalDiscount))}
                  </div>
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
        </TabsContent>

        <TabsContent value="items">
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" 
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <Percent className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Sconti Specifici per Item
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Gestisci sconti individuali per singoli prodotti
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Prezzo Unitario</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valore</TableHead>
                        <TableHead>Importo Sconto</TableHead>
                        <TableHead>Data Inizio</TableHead>
                        <TableHead>Data Fine</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items
                        .filter(item => itemDiscounts[item.id] || discounts.perItemOverrides?.[item.id])
                        .map((item) => {
                          // Use local state discount if exists, otherwise use saved discount
                          const discount = itemDiscounts[item.id] || discounts.perItemOverrides?.[item.id] || { type: "percent", value: 0 };
                          
                          // Calculate discount amount
                          const unitPrice = item.price;
                          let discountAmount = 0;
                          if (discount.value && discount.value > 0) {
                            if (discount.type === "percent") {
                              discountAmount = (unitPrice * discount.value) / 100;
                            } else {
                              discountAmount = Math.min(discount.value, unitPrice);
                            }
                          }
                          
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium">{item.title}</div>
                                <div className="text-sm text-gray-500">{item.category}</div>
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-brand-accent">
                                  €{unitPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={discount.type}
                                  onValueChange={(value: "percent" | "fixed") => 
                                    updateItemDiscount(item.id, "type", value)
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percent">%</SelectItem>
                                    <SelectItem value="fixed">€</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={discount.type === "percent" ? "100" : undefined}
                                  step={discount.type === "percent" ? "1" : "0.01"}
                                  value={discount.value || ""}
                                  onChange={(e) => 
                                    updateItemDiscount(item.id, "value", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-green-600">
                                  {discountAmount > 0 ? (
                                    <>
                                      -€{discountAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                      <div className="text-xs text-gray-500">
                                        Prezzo finale: €{(unitPrice - discountAmount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      {discount.startDate ? (
                                        format(discount.startDate instanceof Date ? discount.startDate : new Date(discount.startDate), "dd/MM/yy", { locale: it })
                                      ) : (
                                        "Imposta"
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={discount.startDate instanceof Date ? discount.startDate : discount.startDate ? new Date(discount.startDate) : undefined}
                                      onSelect={(date) => updateItemDiscount(item.id, "startDate", date)}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      {discount.endDate ? (
                                        format(discount.endDate instanceof Date ? discount.endDate : new Date(discount.endDate), "dd/MM/yy", { locale: it })
                                      ) : (
                                        "Imposta"
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={discount.endDate instanceof Date ? discount.endDate : discount.endDate ? new Date(discount.endDate) : undefined}
                                      onSelect={(date) => updateItemDiscount(item.id, "endDate", date)}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(getDiscountStatus(discount))}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeItemDiscount(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 text-brand-accent">Aggiungi Sconto per Item</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items
                      .filter(item => !itemDiscounts[item.id] && !discounts.perItemOverrides?.[item.id])
                      .map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          onClick={() => addItemDiscount(item.id)}
                          className="justify-start btn-secondary"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {item.title}
                        </Button>
                      ))}
                  </div>
                  {items.filter(item => !itemDiscounts[item.id] && !discounts.perItemOverrides?.[item.id]).length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">Tutti gli item hanno già uno sconto configurato.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-brand-accent">
                  {globalDiscount.value && globalDiscount.value > 0 ? 1 : 0}
                </div>
                <p className="text-xs text-muted-foreground">Sconto Globale</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {Object.values(itemDiscounts).filter(d => getDiscountStatus(d) === "active").length}
                </div>
                <p className="text-xs text-muted-foreground">Sconti Attivi</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">
                  {Object.values(itemDiscounts).filter(d => getDiscountStatus(d) === "scheduled").length}
                </div>
                <p className="text-xs text-muted-foreground">Sconti Programmati</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">
                  {Object.values(itemDiscounts).filter(d => getDiscountStatus(d) === "expired").length}
                </div>
                <p className="text-xs text-muted-foreground">Sconti Scaduti</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Riepilogo Configurazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {globalDiscount.value && globalDiscount.value > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900">Sconto Globale</h4>
                    <p className="text-blue-700">
                      {globalDiscount.type === "percent" ? `${globalDiscount.value}%` : `€${globalDiscount.value}`}
                      {globalDiscount.startDate && ` dal ${format(globalDiscount.startDate, "dd/MM/yyyy", { locale: it })}`}
                      {globalDiscount.endDate && ` fino al ${format(globalDiscount.endDate, "dd/MM/yyyy", { locale: it })}`}
                    </p>
                  </div>
                )}

                {Object.entries(itemDiscounts).filter(([_, discount]) => discount.value && discount.value > 0).length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Sconti Specifici</h4>
                    <div className="space-y-1">
                      {Object.entries(itemDiscounts)
                        .filter(([_, discount]) => discount.value && discount.value > 0)
                        .map(([itemId, discount]) => {
                          const item = items.find(i => i.id === itemId);
                          return (
                            <p key={itemId} className="text-green-700 text-sm">
                              {item?.title}: {discount.type === "percent" ? `${discount.value}%` : `€${discount.value}`}
                              {getStatusBadge(getDiscountStatus(discount))}
                            </p>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
