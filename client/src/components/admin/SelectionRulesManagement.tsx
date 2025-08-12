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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit2, Trash2, Settings, Gift, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SelectionRule } from "../../../shared/rulesSchema";
import type { Item } from "../../../shared/schema";

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
    requiredItems: [] as string[]
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
      const ruleData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        active: formData.active,
        priority: formData.priority,
        action: formData.action,
        targetItems: formData.targetItems,
        conditions: {
          type: "required_items" as const,
          requiredItems: formData.requiredItems
        },
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
      requiredItems: []
    });
    setEditingRule(null);
  };

  const openEditDialog = (rule: SelectionRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      type: rule.type,
      active: rule.active,
      priority: rule.priority,
      action: rule.action,
      targetItems: rule.targetItems,
      requiredItems: rule.conditions.requiredItems || []
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento regole...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Regole di Selezione</h2>
          <p className="text-white/80">
            Configura regole per disponibilità condizionale e regali automatici
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="space-x-2 bg-white text-brand-accent hover:bg-white/90">
              <Plus className="w-4 h-4" />
              <span>Nuova Regola</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? "Modifica Regola" : "Nuova Regola di Selezione"}
              </DialogTitle>
              <DialogDescription>
                Configura condizioni e azioni per la regola di selezione
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Informazioni base */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Regola</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Es: Foto Invitati Gratis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo Regola</Label>
                  <Select value={formData.type} onValueChange={(value: "availability" | "gift_transformation") => 
                    setFormData(prev => ({ ...prev, type: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="availability">Disponibilità Condizionale</SelectItem>
                      <SelectItem value="gift_transformation">Regalo Automatico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione della regola..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorità</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action">Azione</Label>
                  <Select value={formData.action} onValueChange={(value: "disable" | "enable" | "make_gift") => 
                    setFormData(prev => ({ ...prev, action: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disable">Disabilita</SelectItem>
                      <SelectItem value="make_gift">Rendi Gratuito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                  />
                  <Label htmlFor="active">Regola Attiva</Label>
                </div>
              </div>

              {/* Items richiesti */}
              <div className="space-y-2">
                <Label>Items Richiesti</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
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
                      />
                      <label
                        htmlFor={`required-${item.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {item.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items target */}
              <div className="space-y-2">
                <Label>Items Target</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
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
                      />
                      <label
                        htmlFor={`target-${item.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {item.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="button" onClick={handleSaveRule}>
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
          <Card>
            <CardContent className="text-center py-8">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessuna regola configurata</h3>
              <p className="text-muted-foreground mb-4">
                Crea la prima regola di selezione per gestire disponibilità condizionale e regali automatici.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crea Prima Regola
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {rule.type === "gift_transformation" ? (
                        <Gift className="w-4 h-4 text-green-600" />
                      ) : (
                        <Ban className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{rule.name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={rule.type === "gift_transformation" ? "default" : "secondary"}>
                          {rule.type === "gift_transformation" ? "Regalo" : "Disponibilità"}
                        </Badge>
                        <Badge variant={rule.active ? "default" : "secondary"}>
                          {rule.active ? "Attiva" : "Disattivata"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
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
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina regola</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare la regola "{rule.name}"? 
                            Questa azione non può essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteRule(rule.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                  <CardDescription>{rule.description}</CardDescription>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}