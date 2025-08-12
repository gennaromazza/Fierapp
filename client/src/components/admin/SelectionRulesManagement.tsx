import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit2, Trash2, Settings, Gift, Ban, HelpCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SelectionRule } from "../../../../shared/rulesSchema";
import type { Item } from "../../../../shared/schema";

export default function SelectionRulesManagement() {
  const [rules, setRules] = useState<SelectionRule[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<SelectionRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form state semplificato
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "availability" as "availability" | "gift_transformation",
    active: true,
    priority: 1,
    action: "disable" as "disable" | "enable" | "make_gift",
    targetItems: [] as string[],
    requiredItems: [] as string[],
    conditionType: "required_items" as "required_items" | "mutually_exclusive",
    mutuallyExclusiveWith: [] as string[]
  });

  useEffect(() => {
    // Carica regole da Firestore
    const rulesUnsubscribe = onSnapshot(
      query(collection(db, "selection_rules"), orderBy("priority", "asc")),
      (snapshot) => {
        const rulesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as SelectionRule[];
        setRules(rulesData);
        setLoading(false);
      }
    );

    // Carica items per i selettori
    const itemsUnsubscribe = onSnapshot(
      query(collection(db, "items"), orderBy("title", "asc")),
      (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Item[];
        setItems(itemsData);
      }
    );

    return () => {
      rulesUnsubscribe();
      itemsUnsubscribe();
    };
  }, []);

  const handleSaveRule = async () => {
    try {
      // Costruisci le condizioni basate sul tipo selezionato
      let conditions;
      if (formData.conditionType === "mutually_exclusive") {
        conditions = {
          type: "mutually_exclusive" as const,
          mutuallyExclusiveWith: formData.mutuallyExclusiveWith
        };
      } else {
        conditions = {
          type: "required_items" as const,
          requiredItems: formData.requiredItems
        };
      }

      const ruleData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        active: formData.active,
        priority: formData.priority,
        action: formData.action,
        targetItems: formData.targetItems,
        conditions,
        updatedAt: new Date(),
      };

      if (editingRule) {
        await updateDoc(doc(db, "selection_rules", editingRule.id), ruleData);
        toast({
          title: "Regola aggiornata",
          description: "La regola di selezione è stata modificata con successo.",
        });
      } else {
        await addDoc(collection(db, "selection_rules"), {
          ...ruleData,
          createdAt: new Date(),
        });
        toast({
          title: "Regola creata",
          description: "Nuova regola di selezione aggiunta con successo.",
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Errore nel salvare la regola:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore nel salvare la regola.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteDoc(doc(db, "selection_rules", ruleId));
      toast({
        title: "Regola eliminata",
        description: "La regola di selezione è stata rimossa.",
      });
    } catch (error) {
      console.error("Errore nell'eliminare la regola:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore nell'eliminare la regola.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "availability",
      active: true,
      priority: 1,
      action: "disable",
      targetItems: [],
      requiredItems: [],
      conditionType: "required_items",
      mutuallyExclusiveWith: []
    });
    setEditingRule(null);
  };

  const openEditDialog = (rule: SelectionRule) => {
    setEditingRule(rule);
    const conditionType = rule.conditions.type;
    setFormData({
      name: rule.name,
      description: rule.description || "",
      type: rule.type,
      active: rule.active,
      priority: rule.priority,
      action: rule.action,
      targetItems: rule.targetItems,
      requiredItems: rule.conditions.requiredItems || [],
      conditionType: conditionType,
      mutuallyExclusiveWith: rule.conditions.mutuallyExclusiveWith || []
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-4"></div>
          <p className="text-brand-text-secondary">Caricamento regole...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">Regole di Selezione</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-5 h-5 text-white/60 hover:text-white" />
                </TooltipTrigger>
                <TooltipContent 
                  className="max-w-xs bg-brand-surface border-brand-border z-50" 
                  side="bottom" 
                  align="start"
                >
                  <div className="text-brand-text-primary">
                    <p className="font-semibold mb-2">Sistema Regole di Selezione</p>
                    <p className="text-xs">Permette di creare logiche automatiche per:</p>
                    <ul className="text-xs mt-1 space-y-1">
                      <li>• Rendere prodotti disponibili solo se altri sono selezionati</li>
                      <li>• Trasformare automaticamente prodotti in regali gratuiti</li>
                      <li>• Gestire dipendenze tra servizi e prodotti</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-white/80">
            Configura regole per disponibilità condizionale e regali automatici
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="space-x-2 bg-brand-accent text-white hover:bg-brand-accent/90">
              <Plus className="w-4 h-4" />
              <span>Nuova Regola</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-brand-primary border-brand-border">
            <DialogHeader>
              <DialogTitle className="text-brand-text-primary">
                {editingRule ? "Modifica Regola" : "Nuova Regola di Selezione"}
              </DialogTitle>
              <DialogDescription className="text-brand-text-secondary">
                Configura condizioni e azioni per la regola di selezione
              </DialogDescription>
              <div className="bg-brand-primary p-3 rounded border-brand-border border mb-6">
                <span className="text-sm text-brand-text-primary">
                  <strong>Come funziona:</strong> Se il cliente seleziona gli "Items Richiesti", 
                  allora gli "Items Target" verranno modificati secondo l'azione scelta.
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Informazioni base */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-brand-text-primary">Nome Regola</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Es: Foto Invitati Gratis"
                    className="bg-brand-primary border-brand-border text-brand-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="type" className="text-brand-text-primary">Tipo Regola</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-brand-text-secondary hover:text-brand-text-primary" />
                        </TooltipTrigger>
                        <TooltipContent 
                          className="max-w-64 bg-brand-surface border-brand-border z-50" 
                          side="right" 
                          align="start"
                        >
                          <div className="text-brand-text-primary text-xs">
                            <p className="font-semibold mb-2">Tipi di Regola:</p>
                            <div className="space-y-1">
                              <div>
                                <p className="font-medium">Disponibilità Condizionale</p>
                                <p className="text-brand-text-secondary">Rende disponibili/non disponibili prodotti</p>
                              </div>
                              <div>
                                <p className="font-medium">Regalo Automatico</p>
                                <p className="text-brand-text-secondary">Trasforma prodotti in regali gratuiti</p>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={formData.type} onValueChange={(value: "availability" | "gift_transformation") => 
                    setFormData(prev => ({ ...prev, type: value }))
                  }>
                    <SelectTrigger className="bg-brand-primary border-brand-border text-brand-text-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-brand-surface border-brand-border">
                      <SelectItem value="availability" className="text-brand-text-primary">Disponibilità Condizionale</SelectItem>
                      <SelectItem value="gift_transformation" className="text-brand-text-primary">Regalo Automatico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-brand-text-primary">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione della regola..."
                  rows={2}
                  className="bg-brand-primary border-brand-border text-brand-text-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-brand-text-primary">Priorità</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                    className="bg-brand-primary border-brand-border text-brand-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="action" className="text-brand-text-primary">Azione</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-brand-text-secondary hover:text-brand-text-primary" />
                        </TooltipTrigger>
                        <TooltipContent 
                          className="max-w-60 bg-brand-surface border-brand-border z-50" 
                          side="right" 
                          align="start"
                        >
                          <div className="text-brand-text-primary text-xs">
                            <p className="font-semibold">Azioni Disponibili:</p>
                            <div className="mt-1 space-y-1">
                              <div>
                                <p className="font-medium">Disabilita</p>
                                <p className="text-brand-text-secondary">Rende non selezionabili gli items</p>
                              </div>
                              <div>
                                <p className="font-medium">Rendi Gratuito</p>
                                <p className="text-brand-text-secondary">Prezzo = 0€ automaticamente</p>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={formData.action} onValueChange={(value: "disable" | "enable" | "make_gift") => 
                    setFormData(prev => ({ ...prev, action: value }))
                  }>
                    <SelectTrigger className="bg-brand-primary border-brand-border text-brand-text-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-brand-surface border-brand-border">
                      <SelectItem value="disable" className="text-brand-text-primary">Disabilita</SelectItem>
                      <SelectItem value="make_gift" className="text-brand-text-primary">Rendi Gratuito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                  />
                  <Label htmlFor="active" className="text-brand-text-primary">Regola Attiva</Label>
                </div>
              </div>

              {/* Tipo di condizione */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label className="text-brand-text-primary">Tipo di Condizione</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-brand-text-secondary hover:text-brand-text-primary" />
                      </TooltipTrigger>
                      <TooltipContent 
                        className="max-w-80 bg-brand-surface border-brand-border z-50" 
                        side="top" 
                        align="start"
                      >
                        <div className="text-brand-text-primary text-xs">
                          <p className="font-semibold mb-2">Tipi di Condizione:</p>
                          <div className="space-y-2">
                            <div>
                              <p className="font-medium">Items Richiesti</p>
                              <p className="text-brand-text-secondary">Il cliente deve selezionare prodotti specifici</p>
                            </div>
                            <div>
                              <p className="font-medium">Esclusione Mutua</p>
                              <p className="text-brand-text-secondary">Se selezionato uno, disabilita automaticamente gli altri</p>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={formData.conditionType} onValueChange={(value: "required_items" | "mutually_exclusive") => 
                  setFormData(prev => ({ ...prev, conditionType: value }))
                }>
                  <SelectTrigger className="bg-brand-primary border-brand-border text-brand-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-brand-surface border-brand-border">
                    <SelectItem value="required_items" className="text-brand-text-primary">Items Richiesti</SelectItem>
                    <SelectItem value="mutually_exclusive" className="text-brand-text-primary">Esclusione Mutua</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Items richiesti - Solo per condizione "required_items" */}
              {formData.conditionType === "required_items" && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label className="text-brand-text-primary">Items Richiesti</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-brand-text-secondary hover:text-brand-text-primary" />
                        </TooltipTrigger>
                        <TooltipContent 
                          className="max-w-72 bg-brand-surface border-brand-border z-50" 
                          side="top" 
                          align="start"
                        >
                          <div className="text-brand-text-primary text-xs">
                            <p className="font-semibold">Items Richiesti (Condizioni)</p>
                            <p className="mt-1">Prodotti/servizi che il cliente DEVE aver scelto.</p>
                            <p className="mt-2 text-brand-text-secondary">
                              Es: "Videomaker" come condizione per rendere "Foto Invitati" gratis.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-brand-primary p-4 rounded border-brand-border border">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`required-${item.id}`}
                        checked={formData.requiredItems.includes(item.id)}
                        onChange={(e) => {
                          const requiredItems = e.target.checked
                            ? [...formData.requiredItems, item.id]
                            : formData.requiredItems.filter(id => id !== item.id);
                          setFormData(prev => ({ ...prev, requiredItems }));
                        }}
                        className="accent-brand-accent"
                      />
                      <label
                        htmlFor={`required-${item.id}`}
                        className="text-sm cursor-pointer text-brand-text-primary"
                      >
                        {item.title}
                      </label>
                    </div>
                  ))}
                </div>
                </div>
              )}

              {/* Items per esclusione mutua - Solo per condizione "mutually_exclusive" */}
              {formData.conditionType === "mutually_exclusive" && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label className="text-brand-text-primary">Items Mutualmente Esclusivi</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-brand-text-secondary hover:text-brand-text-primary" />
                        </TooltipTrigger>
                        <TooltipContent 
                          className="max-w-72 bg-brand-surface border-brand-border z-50" 
                          side="top" 
                          align="start"
                        >
                          <div className="text-brand-text-primary text-xs">
                            <p className="font-semibold">Items Mutualmente Esclusivi</p>
                            <p className="mt-1">Se il cliente seleziona uno di questi, gli altri diventano non disponibili.</p>
                            <p className="mt-2 text-brand-text-secondary">
                              Es: "Album Big" e "Album Piccolo" si escludono a vicenda.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-brand-primary p-4 rounded border-brand-border border">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`mutually-exclusive-${item.id}`}
                          checked={formData.mutuallyExclusiveWith.includes(item.id)}
                          onChange={(e) => {
                            const mutuallyExclusiveWith = e.target.checked
                              ? [...formData.mutuallyExclusiveWith, item.id]
                              : formData.mutuallyExclusiveWith.filter(id => id !== item.id);
                            setFormData(prev => ({ ...prev, mutuallyExclusiveWith }));
                          }}
                          className="accent-brand-accent"
                        />
                        <label
                          htmlFor={`mutually-exclusive-${item.id}`}
                          className="text-sm cursor-pointer text-brand-text-primary"
                        >
                          {item.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items target */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label className="text-brand-text-primary">Items Target</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-brand-text-secondary hover:text-brand-text-primary" />
                      </TooltipTrigger>
                      <TooltipContent 
                        className="max-w-72 bg-brand-surface border-brand-border z-50" 
                        side="top" 
                        align="start"
                      >
                        <div className="text-brand-text-primary text-xs">
                          <p className="font-semibold">Items Target (Destinazione)</p>
                          <p className="mt-1">Prodotti/servizi che verranno MODIFICATI.</p>
                          <p className="mt-2 text-brand-text-secondary">
                            Es: "Foto Invitati" come target per diventare gratis.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-brand-primary p-4 rounded border-brand-border border">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`target-${item.id}`}
                        checked={formData.targetItems.includes(item.id)}
                        onChange={(e) => {
                          const targetItems = e.target.checked
                            ? [...formData.targetItems, item.id]
                            : formData.targetItems.filter(id => id !== item.id);
                          setFormData(prev => ({ ...prev, targetItems }));
                        }}
                        className="accent-brand-accent"
                      />
                      <label
                        htmlFor={`target-${item.id}`}
                        className="text-sm cursor-pointer text-brand-text-primary"
                      >
                        {item.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-brand-border text-brand-text-secondary hover:bg-brand-surface"
                >
                  Annulla
                </Button>
                <Button 
                  type="button" 
                  onClick={handleSaveRule}
                  className="bg-brand-accent text-white hover:bg-brand-accent/90"
                >
                  {editingRule ? "Aggiorna" : "Crea"} Regola
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista regole esistenti */}
      <div className="grid gap-4">
        {rules.length === 0 ? (
          <Card className="bg-brand-surface border-brand-border">
            <CardContent className="text-center py-8">
              <Settings className="w-12 h-12 text-brand-text-secondary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-brand-text-primary">Nessuna regola configurata</h3>
              <p className="text-brand-text-secondary mb-4">
                Crea la prima regola di selezione per gestire disponibilità condizionale e regali automatici.
              </p>
              <Button 
                onClick={() => setIsDialogOpen(true)}
                className="bg-brand-accent text-white hover:bg-brand-accent/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crea Prima Regola
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="bg-brand-surface border-brand-border hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-brand-primary">
                      {rule.type === "gift_transformation" ? (
                        <Gift className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-orange-400" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg text-brand-text-primary">{rule.name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge 
                          variant={rule.type === "gift_transformation" ? "default" : "secondary"}
                          className={rule.type === "gift_transformation" ? "bg-green-600 text-white" : "bg-brand-accent text-white"}
                        >
                          {rule.type === "gift_transformation" ? "Regalo" : "Disponibilità"}
                        </Badge>
                        <Badge 
                          variant={rule.active ? "default" : "secondary"}
                          className={rule.active ? "bg-brand-accent text-white" : "bg-brand-text-secondary text-brand-surface"}
                        >
                          {rule.active ? "Attiva" : "Disattivata"}
                        </Badge>
                        <span className="text-sm text-brand-text-secondary">
                          Priorità: {rule.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(rule)}
                      className="text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-primary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-brand-text-secondary hover:text-red-400 hover:bg-brand-primary"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-brand-primary border-brand-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-brand-text-primary">Elimina regola</AlertDialogTitle>
                          <AlertDialogDescription className="text-brand-text-secondary">
                            Sei sicuro di voler eliminare la regola "{rule.name}"? 
                            Questa azione non può essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-brand-border text-brand-text-secondary hover:bg-brand-primary">
                            Annulla
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteRule(rule.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              {rule.description && (
                <CardContent className="pt-0">
                  <CardDescription className="text-brand-text-secondary">{rule.description}</CardDescription>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}