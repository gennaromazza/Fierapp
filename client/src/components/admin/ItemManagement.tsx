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
import { Plus, Edit, Trash2, Upload, Image as ImageIcon } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Gestione Items</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-brand-accent hover:bg-brand-hover">
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
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
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
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

      <Card className="card-brand">
        <CardHeader className="card-header-brand">
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Immagine</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prezzo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
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
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-sm text-gray-500">{item.subtitle}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.category === "servizio" ? "default" : "secondary"}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">€{item.price.toFixed(2)}</div>
                        {item.originalPrice && item.originalPrice !== item.price && (
                          <div className="text-sm text-gray-500 line-through">
                            €{item.originalPrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Attivo" : "Inattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(item)}
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
    </div>
  );
}
