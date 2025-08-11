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
    heroTitle: "OFFERTE SPECIALI FIERA",
    heroSubtitle: "Scopri i nostri pacchetti esclusivi con sconti fino al 30%",
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
    socialMedia: {
      facebook: "",
      instagram: "",
      youtube: "",
      twitter: "",
      linkedin: "",
      tiktok: ""
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Palette management functions
  const handlePaletteUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let palette: any;

      if (file.name.endsWith('.json')) {
        palette = JSON.parse(text);
      } else if (file.name.endsWith('.txt')) {
        // Simple text format: one hex color per line
        const colors = text.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('#'))
          .slice(0, 9); // Take first 9 colors

        if (colors.length >= 3) {
          palette = {
            brandPrimary: colors[0] || "#F1EFEC",
            brandSecondary: colors[1] || "#D4C9BE",
            brandAccent: colors[2] || "#123458",
            brandTextPrimary: colors[3] || "#1a1a1a",
            brandTextSecondary: colors[4] || "#6b7280",
            brandTextAccent: colors[5] || "#123458",
            brandBackground: colors[6] || "#ffffff",
            brandSurface: colors[7] || "#f8fafc",
            brandBorder: colors[8] || "#e2e8f0"
          };
        }
      }

      if (palette && typeof palette === 'object') {
        setSettings(prev => ({ ...prev, ...palette }));
        toast({
          title: "Palette Caricata",
          description: "I colori dalla palette sono stati applicati con successo"
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile leggere il file palette",
        variant: "destructive"
      });
    }
  };

  const applyPresetPalette = (preset: string) => {
    const palettes = {
      elegant: {
        brandPrimary: "#f8fafc",
        brandSecondary: "#e2e8f0",
        brandAccent: "#475569",
        brandTextPrimary: "#1e293b",
        brandTextSecondary: "#64748b",
        brandTextAccent: "#334155",
        brandBackground: "#ffffff",
        brandSurface: "#f1f5f9",
        brandBorder: "#cbd5e1"
      },
      vibrant: {
        brandPrimary: "#eff6ff",
        brandSecondary: "#bfdbfe",
        brandAccent: "#2563eb",
        brandTextPrimary: "#1e40af",
        brandTextSecondary: "#6b7280",
        brandTextAccent: "#1d4ed8",
        brandBackground: "#ffffff",
        brandSurface: "#f0f9ff",
        brandBorder: "#93c5fd"
      },
      earth: {
        brandPrimary: "#fefce8",
        brandSecondary: "#fde68a",
        brandAccent: "#b45309",
        brandTextPrimary: "#92400e",
        brandTextSecondary: "#6b7280",
        brandTextAccent: "#a16207",
        brandBackground: "#fffbeb",
        brandSurface: "#fef3c7",
        brandBorder: "#f3e8ff"
      },
      ocean: {
        brandPrimary: "#ecfdf5",
        brandSecondary: "#a7f3d0",
        brandAccent: "#047857",
        brandTextPrimary: "#064e3b",
        brandTextSecondary: "#6b7280",
        brandTextAccent: "#059669",
        brandBackground: "#f0fdfa",
        brandSurface: "#ccfbf1",
        brandBorder: "#6ee7b7"
      }
    };

    const selectedPalette = palettes[preset as keyof typeof palettes];
    if (selectedPalette) {
      setSettings(prev => ({ ...prev, ...selectedPalette }));
      toast({
        title: "Palette Applicata",
        description: `Palette "${preset}" applicata con successo`
      });
    }
  };

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
      {/* Header Section */}
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
              <SettingsIcon className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-2xl">
                Impostazioni
              </h2>
              <p className="text-white/80 text-lg font-medium mt-1 drop-shadow-lg">
                Configura il tuo studio fotografico
              </p>
            </div>
          </div>

          <Button
            onClick={saveSettings}
            disabled={saving || logoUploading}
            className="relative px-8 py-4 text-lg font-bold text-white rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl disabled:opacity-50 disabled:transform-none overflow-hidden group"
            style={{
              background: saving || logoUploading
                ? 'linear-gradient(135deg, #6b7280, #9ca3af)'
                : 'linear-gradient(135deg, #10b981, #059669, #047857)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)'
            }}
          >
            {/* Animated background for button */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>

            <div className="relative z-10 flex items-center">
              <Save className="w-5 h-5 mr-3" />
              {saving ? "Salvando..." : "Salva Impostazioni"}
            </div>
          </Button>
        </div>

        {/* Decorative glow effect */}
        <div className="absolute inset-0 rounded-2xl shadow-inner"
             style={{
               boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)'
             }}></div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="studio" className="space-y-6">
        <TabsList className="glass rounded-xl p-2 shadow-elegant">
          <TabsTrigger
            value="studio"
            className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow"
          >
            Studio
          </TabsTrigger>
          <TabsTrigger
            value="branding"
            className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow"
          >
            Branding
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow"
          >
            Contatti
          </TabsTrigger>
          <TabsTrigger
            value="forms"
            className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow"
          >
            Form
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow"
          >
            Integrazioni
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studio">
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Informazioni Studio
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configura i dati base del tuo studio
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="studioName" className="text-sm font-semibold text-brand-accent">
                  Nome Studio *
                </Label>
                <Input
                  id="studioName"
                  value={settings.studioName || ""}
                  onChange={(e) => setSettings({ ...settings, studioName: e.target.value })}
                  placeholder="Es. Studio Fotografico Demo"
                  className="h-11"
                  required
                />
              </div>

              <div>
                <Label htmlFor="heroTitle" className="text-sm font-semibold text-brand-accent">Titolo Hero Section</Label>
                <Input
                  id="heroTitle"
                  value={settings.heroTitle || "OFFERTE SPECIALI FIERA"}
                  onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                  placeholder="OFFERTE SPECIALI FIERA"
                  className="h-11"
                />
              </div>

              <div>
                <Label htmlFor="heroSubtitle" className="text-sm font-semibold text-brand-accent">Sottotitolo Hero Section</Label>
                <Input
                  id="heroSubtitle"
                  value={settings.heroSubtitle || "Scopri i nostri pacchetti esclusivi con sconti fino al 30%"}
                  onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                  placeholder="Scopri i nostri pacchetti esclusivi con sconti fino al 30%"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studioAddress" className="text-sm font-semibold text-brand-accent">
                  Indirizzo Studio
                </Label>
                <Textarea
                  id="studioAddress"
                  value={settings.studioAddress || ""}
                  onChange={(e) => setSettings({ ...settings, studioAddress: e.target.value })}
                  placeholder="Via Roma 123, 20121 Milano (MI)"
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
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

            {/* Advanced Color Palette */}
            <div className="space-y-6">
              {/* Color Palette Loader */}
              <Card className="card-premium shadow-elegant">
                <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                         style={{ backgroundColor: 'var(--brand-accent)' }}>
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-brand-accent">
                        Carica Palette
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Importa colori da file esterni
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paletteFile" className="text-sm font-semibold text-brand-accent">
                      Carica file palette (.json, .ase, .txt)
                    </Label>
                    <Input
                      id="paletteFile"
                      type="file"
                      accept=".json,.ase,.txt"
                      onChange={handlePaletteUpload}
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500">
                      Supporta file JSON con colori hex o file Adobe Swatch Exchange (.ase)
                    </p>
                  </div>

                  {/* Preset Palettes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-brand-accent">
                      Palette Predefinite
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPresetPalette('elegant')}
                        className="justify-start space-x-2 btn-secondary"
                      >
                        <div className="flex space-x-1">
                          <div className="w-3 h-3 rounded-full bg-slate-100"></div>
                          <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                          <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                        </div>
                        <span>Elegante</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPresetPalette('vibrant')}
                        className="justify-start space-x-2 btn-secondary"
                      >
                        <div className="flex space-x-1">
                          <div className="w-3 h-3 rounded-full bg-blue-50"></div>
                          <div className="w-3 h-3 rounded-full bg-blue-200"></div>
                          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        </div>
                        <span>Vibrante</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPresetPalette('earth')}
                        className="justify-start space-x-2 btn-secondary"
                      >
                        <div className="flex space-x-1">
                          <div className="w-3 h-3 rounded-full bg-amber-50"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-200"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-700"></div>
                        </div>
                        <span>Terra</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPresetPalette('ocean')}
                        className="justify-start space-x-2 btn-secondary"
                      >
                        <div className="flex space-x-1">
                          <div className="w-3 h-3 rounded-full bg-cyan-50"></div>
                          <div className="w-3 h-3 rounded-full bg-cyan-200"></div>
                          <div className="w-3 h-3 rounded-full bg-cyan-700"></div>
                        </div>
                        <span>Oceano</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Colors */}
              <Card className="card-premium shadow-elegant">
                <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                         style={{ backgroundColor: 'var(--brand-accent)' }}>
                      <SettingsIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-brand-accent">
                        Colori Brand
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Personalizza la palette di colori
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  {/* Main Colors */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-brand-accent">Colori Principali</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="brandPrimary" className="text-sm font-semibold text-brand-accent">Primario</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandPrimary"
                            type="color"
                            value={settings.brandPrimary || "#F1EFEC"}
                            onChange={(e) => setSettings({ ...settings, brandPrimary: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandPrimary || "#F1EFEC"}
                            onChange={(e) => setSettings({ ...settings, brandPrimary: e.target.value })}
                            placeholder="#F1EFEC"
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brandSecondary" className="text-sm font-semibold text-brand-accent">Secondario</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandSecondary"
                            type="color"
                            value={settings.brandSecondary || "#D4C9BE"}
                            onChange={(e) => setSettings({ ...settings, brandSecondary: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandSecondary || "#D4C9BE"}
                            onChange={(e) => setSettings({ ...settings, brandSecondary: e.target.value })}
                            placeholder="#D4C9BE"
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brandAccent" className="text-sm font-semibold text-brand-accent">Accento</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandAccent"
                            type="color"
                            value={settings.brandAccent || "#123458"}
                            onChange={(e) => setSettings({ ...settings, brandAccent: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandAccent || "#123458"}
                            onChange={(e) => setSettings({ ...settings, brandAccent: e.target.value })}
                            placeholder="#123458"
                            className="font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Text Colors */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-brand-accent">Colori Testo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="brandTextPrimary" className="text-sm font-semibold text-brand-accent">Testo Primario</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandTextPrimary"
                            type="color"
                            value={settings.brandTextPrimary || "#1a1a1a"}
                            onChange={(e) => setSettings({ ...settings, brandTextPrimary: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandTextPrimary || "#1a1a1a"}
                            onChange={(e) => setSettings({ ...settings, brandTextPrimary: e.target.value })}
                            placeholder="#1a1a1a"
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brandTextSecondary" className="text-sm font-semibold text-brand-accent">Testo Secondario</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandTextSecondary"
                            type="color"
                            value={settings.brandTextSecondary || "#6b7280"}
                            onChange={(e) => setSettings({ ...settings, brandTextSecondary: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandTextSecondary || "#6b7280"}
                            onChange={(e) => setSettings({ ...settings, brandTextSecondary: e.target.value })}
                            placeholder="#6b7280"
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brandTextAccent" className="text-sm font-semibold text-brand-accent">Testo Accento</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandTextAccent"
                            type="color"
                            value={settings.brandTextAccent || "#123458"}
                            onChange={(e) => setSettings({ ...settings, brandTextAccent: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandTextAccent || "#123458"}
                            onChange={(e) => setSettings({ ...settings, brandTextAccent: e.target.value })}
                            placeholder="#123458"
                            className="font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Surface Colors */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-brand-accent">Colori Superfici</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="brandBackground" className="text-sm font-semibold text-brand-accent">Sfondo</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandBackground"
                            type="color"
                            value={settings.brandBackground || "#ffffff"}
                            onChange={(e) => setSettings({ ...settings, brandBackground: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandBackground || "#ffffff"}
                            onChange={(e) => setSettings({ ...settings, brandBackground: e.target.value })}
                            placeholder="#ffffff"
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brandSurface" className="text-sm font-semibold text-brand-accent">Superficie</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandSurface"
                            type="color"
                            value={settings.brandSurface || "#f8fafc"}
                            onChange={(e) => setSettings({ ...settings, brandSurface: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandSurface || "#f8fafc"}
                            onChange={(e) => setSettings({ ...settings, brandSurface: e.target.value })}
                            placeholder="#f8fafc"
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brandBorder" className="text-sm font-semibold text-brand-accent">Bordi</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            id="brandBorder"
                            type="color"
                            value={settings.brandBorder || "#e2e8f0"}
                            onChange={(e) => setSettings({ ...settings, brandBorder: e.target.value })}
                            className="w-12 h-12"
                          />
                          <Input
                            value={settings.brandBorder || "#e2e8f0"}
                            onChange={(e) => setSettings({ ...settings, brandBorder: e.target.value })}
                            placeholder="#e2e8f0"
                            className="font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Color Preview */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-brand-accent">Anteprima</h4>
                    <div className="p-6 rounded-lg border-2 shadow-sm" style={{
                      backgroundColor: settings.brandBackground || "#ffffff",
                      borderColor: settings.brandBorder || "#e2e8f0"
                    }}>
                      <div className="space-y-4">
                        <h5 style={{ color: settings.brandTextPrimary || "#1a1a1a" }} className="text-xl font-bold">
                          Testo Primario
                        </h5>
                        <p style={{ color: settings.brandTextSecondary || "#6b7280" }} className="text-sm">
                          Questo è un esempio di testo secondario per vedere come appare con i tuoi colori.
                        </p>
                        <p style={{ color: settings.brandTextAccent || "#123458" }} className="font-semibold">
                          Testo con colore accento
                        </p>
                        <div className="flex space-x-3 mt-6">
                          <div
                            className="px-6 py-3 rounded-lg text-white font-semibold shadow-md transition-all hover:shadow-lg"
                            style={{ backgroundColor: settings.brandAccent || "#123458" }}
                          >
                            Pulsante Principale
                          </div>
                          <div
                            className="px-6 py-3 rounded-lg font-semibold shadow-sm transition-all hover:shadow-md"
                            style={{
                              backgroundColor: settings.brandSecondary || "#D4C9BE",
                              color: settings.brandTextPrimary || "#1a1a1a"
                            }}
                          >
                            Pulsante Secondario
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          {/* Contact Information */}
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Informazioni di Contatto
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configura i canali di contatto dello studio
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber" className="text-sm font-semibold text-brand-accent">
                    Numero WhatsApp *
                  </Label>
                  <Input
                    id="whatsappNumber"
                    value={settings.whatsappNumber || ""}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    placeholder="+39 333 123 4567"
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500">
                    Numero utilizzato per le richieste dal sito (richiesto)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-semibold text-brand-accent">
                    Telefono Studio
                  </Label>
                  <Input
                    id="phoneNumber"
                    value={settings.phoneNumber || ""}
                    onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                    placeholder="+39 333 123 4567"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-brand-accent">
                  Email Studio
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@studio.com"
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Hours Section */}
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Orari di Apertura
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configura gli orari di apertura dello studio
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="businessHoursEnabled"
                  checked={settings.businessHours?.enabled ?? true}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      businessHours: {
                        ...settings.businessHours,
                        enabled: e.target.checked,
                        weekdays: settings.businessHours?.weekdays || {
                          enabled: true,
                          open: "9:00",
                          close: "18:00",
                          label: "Lun-Ven"
                        },
                        saturday: settings.businessHours?.saturday || {
                          enabled: true,
                          open: "9:00",
                          close: "13:00",
                          label: "Sab"
                        },
                        sunday: settings.businessHours?.sunday || {
                          enabled: false,
                          open: "10:00",
                          close: "12:00",
                          label: "Dom"
                        }
                      }
                    })
                  }
                  className="w-4 h-4 rounded border-2 border-brand-accent accent-brand-accent"
                />
                <Label htmlFor="businessHoursEnabled" className="text-sm font-semibold text-brand-accent">
                  Mostra orari di apertura nel footer
                </Label>
              </div>

              {settings.businessHours?.enabled && (
                <div className="space-y-4 pl-6 border-l-2 border-gray-200">
                  {/* Weekdays */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="weekdaysEnabled"
                        checked={settings.businessHours?.weekdays?.enabled ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              weekdays: {
                                ...settings.businessHours?.weekdays!,
                                enabled: e.target.checked
                              }
                            }
                          })
                        }
                        className="w-4 h-4"
                      />
                      <Label htmlFor="weekdaysEnabled">Giorni feriali</Label>
                    </div>
                    <div>
                      <Label>Etichetta</Label>
                      <Input
                        value={settings.businessHours?.weekdays?.label || "Lun-Ven"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              weekdays: {
                                ...settings.businessHours?.weekdays!,
                                label: e.target.value
                              }
                            }
                          })
                        }
                        placeholder="Lun-Ven"
                      />
                    </div>
                    <div>
                      <Label>Apertura</Label>
                      <Input
                        type="time"
                        value={settings.businessHours?.weekdays?.open || "9:00"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              weekdays: {
                                ...settings.businessHours?.weekdays!,
                                open: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Chiusura</Label>
                      <Input
                        type="time"
                        value={settings.businessHours?.weekdays?.close || "18:00"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              weekdays: {
                                ...settings.businessHours?.weekdays!,
                                close: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Saturday */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="saturdayEnabled"
                        checked={settings.businessHours?.saturday?.enabled ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              saturday: {
                                ...settings.businessHours?.saturday!,
                                enabled: e.target.checked
                              }
                            }
                          })
                        }
                        className="w-4 h-4"
                      />
                      <Label htmlFor="saturdayEnabled">Sabato</Label>
                    </div>
                    <div>
                      <Label>Etichetta</Label>
                      <Input
                        value={settings.businessHours?.saturday?.label || "Sab"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              saturday: {
                                ...settings.businessHours?.saturday!,
                                label: e.target.value
                              }
                            }
                          })
                        }
                        placeholder="Sab"
                      />
                    </div>
                    <div>
                      <Label>Apertura</Label>
                      <Input
                        type="time"
                        value={settings.businessHours?.saturday?.open || "9:00"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              saturday: {
                                ...settings.businessHours?.saturday!,
                                open: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Chiusura</Label>
                      <Input
                        type="time"
                        value={settings.businessHours?.saturday?.close || "13:00"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              saturday: {
                                ...settings.businessHours?.saturday!,
                                close: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Sunday */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="sundayEnabled"
                        checked={settings.businessHours?.sunday?.enabled ?? false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              sunday: {
                                ...settings.businessHours?.sunday!,
                                enabled: e.target.checked
                              }
                            }
                          })
                        }
                        className="w-4 h-4"
                      />
                      <Label htmlFor="sundayEnabled">Domenica</Label>
                    </div>
                    <div>
                      <Label>Etichetta</Label>
                      <Input
                        value={settings.businessHours?.sunday?.label || "Dom"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              sunday: {
                                ...settings.businessHours?.sunday!,
                                label: e.target.value
                              }
                            }
                          })
                        }
                        placeholder="Dom"
                      />
                    </div>
                    <div>
                      <Label>Apertura</Label>
                      <Input
                        type="time"
                        value={settings.businessHours?.sunday?.open || "10:00"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              sunday: {
                                ...settings.businessHours?.sunday!,
                                open: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Chiusura</Label>
                      <Input
                        type="time"
                        value={settings.businessHours?.sunday?.close || "12:00"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            businessHours: {
                              ...settings.businessHours!,
                              sunday: {
                                ...settings.businessHours?.sunday!,
                                close: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Media Section */}
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Social Media
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configura i link ai tuoi profili social
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    type="url"
                    placeholder="https://facebook.com/tuapagina"
                    value={settings.socialMedia?.facebook || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialMedia: {
                          ...settings.socialMedia,
                          facebook: e.target.value
                        }
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    type="url"
                    placeholder="https://instagram.com/tuoaccount"
                    value={settings.socialMedia?.instagram || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialMedia: {
                          ...settings.socialMedia,
                          instagram: e.target.value
                        }
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    type="url"
                    placeholder="https://youtube.com/c/tuocanale"
                    value={settings.socialMedia?.youtube || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialMedia: {
                          ...settings.socialMedia,
                          youtube: e.target.value
                        }
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="twitter">Twitter</Label>
                  <Input
                    id="twitter"
                    type="url"
                    placeholder="https://twitter.com/tuoaccount"
                    value={settings.socialMedia?.twitter || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialMedia: {
                          ...settings.socialMedia,
                          twitter: e.target.value
                        }
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    type="url"
                    placeholder="https://linkedin.com/company/tuoaccount"
                    value={settings.socialMedia?.linkedin || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialMedia: {
                          ...settings.socialMedia,
                          linkedin: e.target.value
                        }
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input
                    id="tiktok"
                    type="url"
                    placeholder="https://tiktok.com/@tuoaccount"
                    value={settings.socialMedia?.tiktok || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialMedia: {
                          ...settings.socialMedia,
                          tiktok: e.target.value
                        }
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Configurazione Form Lead
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Personalizza i campi del form di contatto
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-semibold text-brand-accent">Campi Form</Label>
                  <Button onClick={addFormField} size="sm" variant="outline" className="btn-secondary">
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

              <div className="space-y-2">
                <Label htmlFor="gdprText" className="text-sm font-semibold text-brand-accent">
                  Testo Consenso GDPR
                </Label>
                <Textarea
                  id="gdprText"
                  value={settings.gdprText || ""}
                  onChange={(e) => setSettings({ ...settings, gdprText: e.target.value })}
                  rows={3}
                  placeholder="Testo del consenso GDPR che verrà mostrato nel form"
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  Questo testo verrà mostrato insieme alla checkbox di consenso GDPR
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="card-premium shadow-elegant">
            <CardHeader className="glass rounded-t-xl border-b border-brand-accent/20">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'var(--brand-accent)' }}>
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-accent">
                    Integrazioni Esterne
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configura i servizi di terze parti
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recaptchaSiteKey" className="text-sm font-semibold text-brand-accent">
                  reCAPTCHA Site Key
                </Label>
                <Input
                  id="recaptchaSiteKey"
                  value={settings.reCAPTCHASiteKey || ""}
                  onChange={(e) => setSettings({ ...settings, reCAPTCHASiteKey: e.target.value })}
                  placeholder="6Le..."
                  className="h-11"
                />
                <p className="text-xs text-gray-500">
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