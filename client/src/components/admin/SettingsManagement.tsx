import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../firebase";
import { Settings, FormField } from "@shared/schema";
import { compressImage, validateImageFile } from "../../lib/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Upload, Trash2, Plus, Settings as SettingsIcon, Image as ImageIcon, Phone, Mail, MapPin } from "lucide-react";
import LogoUpload from "./LogoUpload";

export default function SettingsManagement() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<Settings>>({
    studioName: "",
    brandPrimary: "#F1EFEC",
    brandSecondary: "#D4C9BE",
    brandAccent: "#123458",
    whatsappNumber: "",
    phoneNumber: "",
    email: "",
    studioAddress: "",
    formFields: [
      { type: "text", label: "Nome", required: true },
      { type: "text", label: "Cognome", required: true },
      { type: "email", label: "Email", required: true },
      { type: "tel", label: "Telefono", required: true },
      { type: "date", label: "Data evento", required: true },
      { type: "textarea", label: "Note aggiuntive", required: false },
    ],
    gdprText: "Acconsento al trattamento dei miei dati personali secondo la Privacy Policy.",
    reCAPTCHASiteKey: "",
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsDoc = await getDoc(doc(db, "settings", "app"));
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data() as Settings;
        setSettings(settingsData);
        
        // Load logo preview if exists
        if (settingsData.logoUrl) {
          try {
            const logoRef = ref(storage, settingsData.logoUrl);
            const url = await getDownloadURL(logoRef);
            setLogoPreview(url);
          } catch (error) {
            console.warn("Could not load logo preview:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle impostazioni",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      let logoUrl = settings.logoUrl;
      
      // Upload logo if file is selected
      if (logoFile) {
        setLogoUploading(true);
        const compressedLogo = await compressImage(logoFile, 200, 0.9);
        const logoRef = ref(storage, `uploads/logo-${Date.now()}.jpg`);
        await uploadBytes(logoRef, compressedLogo);
        logoUrl = await getDownloadURL(logoRef);
        
        // Delete old logo if exists
        if (settings.logoUrl) {
          try {
            const oldLogoRef = ref(storage, settings.logoUrl);
            await deleteObject(oldLogoRef);
          } catch (error) {
            console.warn("Could not delete old logo:", error);
          }
        }
        
        setLogoPreview(logoUrl);
        setLogoUploading(false);
      }

      const updatedSettings = {
        ...settings,
        logoUrl,
      };

      await setDoc(doc(db, "settings", "app"), updatedSettings);
      setSettings(updatedSettings);
      setLogoFile(null);
      
      toast({
        title: "Impostazioni salvate",
        description: "Le impostazioni sono state salvate con successo",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio delle impostazioni",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setLogoUploading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const updateFormField = (index: number, field: Partial<FormField>) => {
    const newFormFields = [...(settings.formFields || [])];
    newFormFields[index] = { ...newFormFields[index], ...field };
    setSettings({ ...settings, formFields: newFormFields });
  };

  const addFormField = () => {
    const newFormFields = [...(settings.formFields || [])];
    newFormFields.push({ type: "text", label: "", required: false });
    setSettings({ ...settings, formFields: newFormFields });
  };

  const removeFormField = (index: number) => {
    const newFormFields = settings.formFields?.filter((_, i) => i !== index) || [];
    setSettings({ ...settings, formFields: newFormFields });
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
      <div className="flex items-center justify-between glass rounded-xl p-6 shadow-elegant">
        <h2 className="text-3xl font-bold text-gradient">Impostazioni</h2>
        <Button
          onClick={saveSettings}
          disabled={saving || logoUploading}
          className="btn-premium animate-pulse-shadow"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salva Impostazioni"}
        </Button>
      </div>

      <Tabs defaultValue="studio" className="space-y-6">
        <TabsList className="glass rounded-xl p-2 shadow-elegant">
          <TabsTrigger value="studio" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Studio</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Branding</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Contatti</TabsTrigger>
          <TabsTrigger value="forms" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Form</TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow">Integrazioni</TabsTrigger>
        </TabsList>

        <TabsContent value="studio">
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="w-5 h-5" style={{ color: 'var(--brand-accent)' }} />
                <span className="text-xl font-bold text-gradient">Informazioni Studio</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="studioName">Nome Studio *</Label>
                <Input
                  id="studioName"
                  value={settings.studioName || ""}
                  onChange={(e) => setSettings({ ...settings, studioName: e.target.value })}
                  placeholder="Es. Studio Fotografico Demo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="studioAddress">Indirizzo Studio</Label>
                <Textarea
                  id="studioAddress"
                  value={settings.studioAddress || ""}
                  onChange={(e) => setSettings({ ...settings, studioAddress: e.target.value })}
                  placeholder="Via Roma 123, 20121 Milano (MI)"
                  rows={2}
                />
                <p className="text-sm text-gray-500 mt-1">
                  L'indirizzo verrà mostrato nel footer con link a Google Maps
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <LogoUpload
              currentLogoUrl={settings.logoUrl}
              onLogoChange={(logoUrl) => setSettings({ ...settings, logoUrl: logoUrl || undefined })}
              disabled={saving}
            />

            {/* Brand Colors */}
            <Card className="card-premium shadow-elegant">
              <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
                <CardTitle className="text-xl font-bold text-gradient">Colori Brand</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="brandPrimary">Colore Primario</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="brandPrimary"
                      type="color"
                      value={settings.brandPrimary || "#F1EFEC"}
                      onChange={(e) => setSettings({ ...settings, brandPrimary: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.brandPrimary || "#F1EFEC"}
                      onChange={(e) => setSettings({ ...settings, brandPrimary: e.target.value })}
                      placeholder="#F1EFEC"
                    />
                  </div>
                  <div className="mt-2 p-3 rounded-lg border" style={{ backgroundColor: settings.brandPrimary || "#F1EFEC" }}>
                    <span className="text-sm font-medium">Anteprima Primario</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="brandSecondary">Colore Secondario</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="brandSecondary"
                      type="color"
                      value={settings.brandSecondary || "#D4C9BE"}
                      onChange={(e) => setSettings({ ...settings, brandSecondary: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.brandSecondary || "#D4C9BE"}
                      onChange={(e) => setSettings({ ...settings, brandSecondary: e.target.value })}
                      placeholder="#D4C9BE"
                    />
                  </div>
                  <div className="mt-2 p-3 rounded-lg border" style={{ backgroundColor: settings.brandSecondary || "#D4C9BE" }}>
                    <span className="text-sm font-medium">Anteprima Secondario</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="brandAccent">Colore Accento</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="brandAccent"
                      type="color"
                      value={settings.brandAccent || "#123458"}
                      onChange={(e) => setSettings({ ...settings, brandAccent: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.brandAccent || "#123458"}
                      onChange={(e) => setSettings({ ...settings, brandAccent: e.target.value })}
                      placeholder="#123458"
                    />
                  </div>
                  <div className="mt-2 p-3 rounded-lg border text-white" style={{ backgroundColor: settings.brandAccent || "#123458" }}>
                    <span className="text-sm font-medium">Anteprima Accento</span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Nota:</strong> I colori vengono applicati automaticamente a tutta l'applicazione in tempo reale.
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• <strong>Primario:</strong> Sfondi principali e aree contenuto</li>
                    <li>• <strong>Secondario:</strong> Bordi, divisori e elementi di supporto</li>
                    <li>• <strong>Accento:</strong> Pulsanti, titoli e elementi interattivi</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card className="card-brand">
            <CardHeader className="card-header-brand">
              <CardTitle className="flex items-center space-x-2">
                <Phone className="w-5 h-5" />
                <span>Informazioni di Contatto</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="whatsappNumber">Numero WhatsApp *</Label>
                <Input
                  id="whatsappNumber"
                  value={settings.whatsappNumber || ""}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  placeholder="+39 333 123 4567"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Numero utilizzato per le richieste dal sito (richiesto per il funzionamento)
                </p>
              </div>

              <div>
                <Label htmlFor="phoneNumber">Telefono Studio</Label>
                <Input
                  id="phoneNumber"
                  value={settings.phoneNumber || ""}
                  onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                  placeholder="+39 333 123 4567"
                />
              </div>

              <div>
                <Label htmlFor="email">Email Studio</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@studio.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card className="card-brand">
            <CardHeader className="card-header-brand">
              <CardTitle>Configurazione Form Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Campi Form</Label>
                  <Button onClick={addFormField} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi Campo
                  </Button>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Etichetta</TableHead>
                        <TableHead>Richiesto</TableHead>
                        <TableHead>Opzioni</TableHead>
                        <TableHead>Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settings.formFields?.map((field, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={field.type}
                              onValueChange={(value: FormField["type"]) => 
                                updateFormField(index, { type: value })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Testo</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="tel">Telefono</SelectItem>
                                <SelectItem value="date">Data</SelectItem>
                                <SelectItem value="textarea">Area Testo</SelectItem>
                                <SelectItem value="select">Select</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={field.label}
                              onChange={(e) => updateFormField(index, { label: e.target.value })}
                              placeholder="Etichetta campo"
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateFormField(index, { required: e.target.checked })}
                              className="w-4 h-4"
                            />
                          </TableCell>
                          <TableCell>
                            {field.type === "select" && (
                              <Input
                                value={field.options?.join(", ") || ""}
                                onChange={(e) => updateFormField(index, { 
                                  options: e.target.value.split(",").map(s => s.trim()).filter(s => s)
                                })}
                                placeholder="Opzione 1, Opzione 2, ..."
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFormField(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <Label htmlFor="gdprText">Testo Consenso GDPR</Label>
                <Textarea
                  id="gdprText"
                  value={settings.gdprText || ""}
                  onChange={(e) => setSettings({ ...settings, gdprText: e.target.value })}
                  rows={3}
                  placeholder="Testo del consenso GDPR che verrà mostrato nel form"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="card-brand">
            <CardHeader className="card-header-brand">
              <CardTitle>Integrazioni Esterne</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="recaptchaSiteKey">reCAPTCHA Site Key</Label>
                <Input
                  id="recaptchaSiteKey"
                  value={settings.reCAPTCHASiteKey || ""}
                  onChange={(e) => setSettings({ ...settings, reCAPTCHASiteKey: e.target.value })}
                  placeholder="6Le..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  Chiave pubblica di Google reCAPTCHA v3 per protezione anti-spam
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
