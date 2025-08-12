import { useState, useEffect } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../firebase";
import { Item, InsertItem } from "@shared/schema";
import { useCollection } from "../../hooks/useFirestore";
import { compressImage, validateImageFile } from "../../lib/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, Image as ImageIcon, ShoppingBag, Settings2, ArrowLeft, GripVertical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SelectionRulesManagement from "./SelectionRulesManagement";

export default function ItemManagement() {
  const { data: items, loading } = useCollection<Item>("items", [orderBy("sortOrder", "asc")]);
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<Partial<InsertItem>>({
    title: "",
    subtitle: "",
    description: "",
    price: 0,
    originalPrice: 0,
    category: "servizio",
    active: true,
    sortOrder: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [dragOverItem, setDragOverItem] = useState<Item | null>(null);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        title: editingItem.title,
        subtitle: editingItem.subtitle || "",
        description: editingItem.description || "",
        price: editingItem.price,
        originalPrice: editingItem.originalPrice || editingItem.price,
        category: editingItem.category,
        active: editingItem.active,
        sortOrder: editingItem.sortOrder,
      });
      setImagePreview(editingItem.imageUrl || null);
    } else {
      setFormData({
        title: "",
        subtitle: "",
        description: "",
        price: 0,
        originalPrice: 0,
        category: "servizio",
        active: true,
        sortOrder: items.length,
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [editingItem, items.length]);

  // Handler for sort order changes with real-time conflict detection
  const handleSortOrderChange = (newValue: string) => {
    const newSortOrder = parseInt(newValue) || 0;
    setFormData({ ...formData, sortOrder: newSortOrder });
    
    // Check for conflicts and show a visual indicator
    const conflictingItem = items.find(item => 
      item.sortOrder === newSortOrder && 
      item.id !== editingItem?.id
    );
    
    if (conflictingItem) {
      toast({
        title: "Numero d'ordine già utilizzato",
        description: `"${conflictingItem.title}" usa già l'ordine ${newSortOrder}. Sarà spostato automaticamente al salvataggio.`,
      });
    }
  };

  // Drag and Drop functions for reordering
  const handleDragStart = (e: React.DragEvent, item: Item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent, item: Item) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(item);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetItem: Item) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      const draggedIndex = items.findIndex(item => item.id === draggedItem.id);
      const targetIndex = items.findIndex(item => item.id === targetItem.id);
      
      if (draggedIndex === -1 || targetIndex === -1) return;

      // Create a new array with items reordered
      const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
      
      // Remove dragged item and insert at target position
      const [removed] = sortedItems.splice(draggedIndex, 1);
      sortedItems.splice(targetIndex, 0, removed);
      
      // Update all affected items with their new sort order
      const updatePromises = sortedItems.map((item, index) => 
        updateDoc(doc(db, "items", item.id), {
          sortOrder: index,
          updatedAt: new Date(),
        })
      );
      
      await Promise.all(updatePromises);

      toast({
        title: "Ordinamento aggiornato",
        description: `"${draggedItem.title}" è stato riposizionato`,
      });

    } catch (error) {
      console.error("Error reordering items:", error);
      toast({
        title: "Errore",
        description: "Impossibile riordinare gli elementi",
        variant: "destructive",
      });
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      toast({
        title: "Errore file",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Function to handle dynamic sort order management
  const handleSortOrderConflict = async (newSortOrder: number, currentItemId?: string) => {
    // Find if there's already an item with this sort order
    const conflictingItem = items.find(item => 
      item.sortOrder === newSortOrder && 
      item.id !== currentItemId
    );
    
    if (conflictingItem) {
      // Update the conflicting item to have the next available sort order
      const nextAvailableOrder = Math.max(...items.map(i => i.sortOrder)) + 1;
      
      await updateDoc(doc(db, "items", conflictingItem.id), {
        sortOrder: nextAvailableOrder,
        updatedAt: new Date(),
      });
      
      toast({
        title: "Ordine aggiornato",
        description: `"${conflictingItem.title}" è stato spostato all'ordine ${nextAvailableOrder}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Handle sort order conflicts before saving
      if (formData.sortOrder !== undefined) {
        await handleSortOrderConflict(formData.sortOrder, editingItem?.id);
      }

      let imageUrl = editingItem?.imageUrl || "";

      // Upload image if file is selected
      if (imageFile) {
        const compressedImage = await compressImage(imageFile);
        const imageRef = ref(storage, `uploads/items/${Date.now()}-${imageFile.name}`);
        await uploadBytes(imageRef, compressedImage);
        imageUrl = await getDownloadURL(imageRef);

        // Delete old image if updating
        if (editingItem?.imageUrl) {
          try {
            const oldImageRef = ref(storage, editingItem.imageUrl);
            await deleteObject(oldImageRef);
          } catch (error) {
            console.warn("Could not delete old image:", error);
          }
        }
      }

      const itemData = {
        ...formData,
        imageUrl: imageUrl || null,
      };

      if (editingItem) {
        await updateDoc(doc(db, "items", editingItem.id), {
          ...itemData,
          updatedAt: new Date(),
        });
        toast({
          title: "Item aggiornato",
          description: "L'item è stato aggiornato con successo",
        });
      } else {
        await addDoc(collection(db, "items"), {
          ...itemData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        toast({
          title: "Item creato",
          description: "L'item è stato creato con successo",
        });
      }

      setIsDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving item:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Sei sicuro di voler eliminare "${item.title}"?`)) return;

    try {
      await deleteDoc(doc(db, "items", item.id));

      // Delete image if exists
      if (item.imageUrl) {
        try {
          const imageRef = ref(storage, item.imageUrl);
          await deleteObject(imageRef);
        } catch (error) {
          console.warn("Could not delete image:", error);
        }
      }

      toast({
        title: "Item eliminato",
        description: "L'item è stato eliminato con successo",
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  if (loading) {
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
        
        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                 style={{ 
                   background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(255,255,255,0.3)'
                 }}>
              <ShoppingBag className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-2xl">
                Gestione Items
              </h2>
              <p className="text-white/80 text-lg font-medium mt-1 drop-shadow-lg">
                Configura servizi, prodotti e regole di selezione
              </p>
            </div>
          </div>

          <Tabs defaultValue="items" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-white/20 rounded-xl p-2 shadow-elegant border border-white/30">
              <TabsTrigger
                className="flex items-center justify-center space-x-1 sm:space-x-2 rounded-lg font-bold transition-all duration-300 text-white/80 hover:text-white hover:bg-white/10 data-[state=active]:bg-brand-accent data-[state=active]:text-white data-[state=active]:shadow-lg hover:scale-105 px-1 sm:px-3"
                value="items"
              >
                <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm sm:text-base">Items</span>
              </TabsTrigger>
              <TabsTrigger
                className="flex items-center justify-center space-x-1 sm:space-x-2 rounded-lg font-bold transition-all duration-300 text-white/80 hover:text-white hover:bg-white/10 data-[state=active]:bg-brand-accent data-[state=active]:text-white data-[state=active]:shadow-lg hover:scale-105 px-1 sm:px-3"
                value="rules"
              >
                <Settings2 className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm sm:text-base hidden xs:inline">Regole di Selezione</span>
                <span className="text-sm sm:text-base xs:hidden">Regole</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-6">
              <div className="flex justify-end">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={openCreateDialog}
                      className="relative px-8 py-4 text-lg font-bold text-white rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl overflow-hidden group"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669, #047857)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)'
                      }}
                    >
                      {/* Animated background for button */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>
                      
                      <div className="relative z-10 flex items-center">
                        <Plus className="w-5 h-5 mr-3" />
                        Nuovo Item
                      </div>
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-brand-primary">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-brand-accent">
                        {editingItem ? "Modifica Item" : "Nuovo Item"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Titolo *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: "servizio" | "prodotto") => 
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="servizio">Servizio</SelectItem>
                        <SelectItem value="prodotto">Prodotto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="subtitle">Sottotitolo</Label>
                  <Input
                    id="subtitle"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">Prezzo Attuale *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="originalPrice">Prezzo Originale</Label>
                    <Input
                      id="originalPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.originalPrice}
                      onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sortOrder">Ordine</Label>
                    <Input
                      id="sortOrder"
                      type="number"
                      min="0"
                      value={formData.sortOrder}
                      onChange={(e) => handleSortOrderChange(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="image">Immagine</Label>
                  <div className="mt-2">
                    <input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="mb-4"
                    />
                    {imagePreview && (
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="active">Attivo</Label>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                  >
                    {isSubmitting ? "Salvando..." : "Salva"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="hover:bg-brand-secondary hover:text-brand-text"
                  >
                    Annulla
                  </Button>
                    </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="card-premium shadow-elegant">
                <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
                  <CardTitle className="text-xl font-bold text-brand-accent">Items ({items.length})</CardTitle>
                  <p className="text-sm text-brand-text-secondary mt-2">
                    Trascina le righe per riordinare gli elementi rapidamente
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
              <TableHeader className="glass">
                <TableRow>
                  <TableHead className="font-semibold text-brand-accent w-10"></TableHead>
                  <TableHead className="font-semibold text-brand-accent">Ordine</TableHead>
                  <TableHead className="font-semibold text-brand-accent">Immagine</TableHead>
                  <TableHead className="font-semibold text-brand-accent">Titolo</TableHead>
                  <TableHead className="font-semibold text-brand-accent">Categoria</TableHead>
                  <TableHead className="font-semibold text-brand-accent">Prezzo</TableHead>
                  <TableHead className="font-semibold text-brand-accent">Stato</TableHead>
                  <TableHead className="font-semibold text-brand-accent">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className={`hover:bg-brand-secondary/10 transition-colors cursor-move ${
                      dragOverItem?.id === item.id ? 'bg-brand-accent/20 border-l-4 border-brand-accent' : ''
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragOver={(e) => handleDragOver(e, item)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, item)}
                    onDragEnd={handleDragEnd}
                  >
                    <TableCell className="text-brand-text-primary">
                      <GripVertical className="w-4 h-4 text-gray-400 hover:text-brand-accent cursor-grab active:cursor-grabbing" />
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      <Badge variant="outline" className="font-mono">
                        {item.sortOrder}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      <div>
                        <div className="font-medium text-brand-text-primary">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-sm text-brand-text-secondary">{item.subtitle}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      <Badge variant={item.category === "servizio" ? "default" : "secondary"}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      <div>
                        <div className="font-medium text-brand-text-primary">€{item.price.toFixed(2)}</div>
                        {item.originalPrice && item.originalPrice !== item.price && (
                          <div className="text-sm text-brand-text-secondary line-through">
                            €{item.originalPrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Attivo" : "Inattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-brand-text-primary">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(item)}
                          className="hover:scale-105 transition-transform"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rules">
              <SelectionRulesManagement />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
