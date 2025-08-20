import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings } from "@shared/schema";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { generateClientQuotePDF } from "../lib/pdf";
import { MessageCircle, Download, CheckCircle, Sparkles, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ConfirmQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToCheckout?: () => void; // New prop for navigation back to checkout
  onStartOver?: () => void; // New prop to restart the entire chat flow
  leadId: string;
  leadData: {
    customer: any;
    selectedItems: any[];
    pricing: any;
    settings?: any; // Optional settings from parent
  };
}

// Helper functions
const toNum = (n: unknown) => {
  const v = typeof n === "string" ? Number(n) : (n as number);
  return Number.isFinite(v) ? (v as number) : 0;
};

const formatEUR = (n: unknown) =>
  toNum(n).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ConfirmQuoteModal({
  isOpen,
  onClose,
  onBackToCheckout,
  onStartOver,
  leadId,
  leadData,
}: ConfirmQuoteModalProps) {
  const { toast } = useToast();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Use settings from parent or fetch from Firebase as fallback
  const { data: fetchedSettings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const settingsDoc = await getDoc(doc(db, "settings", "app"));
      return settingsDoc.exists() ? (settingsDoc.data() as Settings) : null;
    },
    enabled: !leadData.settings, // Only fetch if not provided by parent
  });

  const settings = leadData.settings || fetchedSettings;

  const handleWhatsAppShare = async () => {
    if (!settings?.whatsappNumber) {
      toast({
        title: "WhatsApp non configurato",
        description: "Il numero WhatsApp non è stato configurato.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      const { customer, selectedItems, pricing } = leadData;

      // Generate items list for WhatsApp
      const itemsList = selectedItems
        .map((item) => {
          const title = item.title ?? "Voce";
          const priceNum = toNum(item.price);
          const originalNum = toNum(item.originalPrice);
          const priceText = item.price === 0 ? "GRATIS" : `€${formatEUR(priceNum)}`;

          // Show crossed out original price if discounted and not gift
          if (item.price !== 0 && originalNum > priceNum) {
            return `• ${title} - ~€${formatEUR(originalNum)}~  €${formatEUR(priceNum)}`;
          }
          // Show crossed out price + GRATIS if gift
          if (item.price === 0 && originalNum > 0) {
            return `• ${title} - ~€${formatEUR(originalNum)}~  GRATIS`;
          }
          return `• ${title} - ${priceText}`;
        })
        .join("\n");

      // Format customer data
      const formDataText = Object.entries(customer)
        .filter(([key, value]) => key !== "gdpr_consent" && value)
        .map(([key, value]) => {
          const field = (settings.formFields ?? []).find(
            (f: any) => f.label.toLowerCase().replace(/\s+/g, "_") === key,
          );
          const label = field?.label || key;
          return `${label}: ${value}`;
        })
        .filter(Boolean)
        .join("\n");

      // Generate pricing breakdown with safe fallbacks
      const individualSavings = toNum(pricing.detailed?.individualDiscountSavings || 0);
      const globalSavings = toNum(pricing.detailed?.globalDiscountSavings || 0);
      const giftSavings = toNum(pricing.giftSavings || 0);
      const totalSavings = toNum(pricing.totalSavings || 0);

      const lines = [
        `Subtotale servizi/prodotti: €${formatEUR(pricing.subtotal)}`,
        ...(individualSavings > 0
          ? [`Sconti per prodotto/servizio: -€${formatEUR(individualSavings)}`]
          : []),
        ...(globalSavings > 0
          ? [`Sconto globale (-10%): -€${formatEUR(globalSavings)}`]
          : []),
        ...(giftSavings > 0
          ? [`Servizi in omaggio: -€${formatEUR(giftSavings)}`]
          : []),
        `TOTALE: €${formatEUR(displayTotal)}`,
        ...(totalSavings > 0
          ? [`💰 Totale risparmiato: €${formatEUR(totalSavings)}!`]
          : []),
      ];
      const totalText = lines.join("\n");

      const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${itemsList}\n\n💰 RIEPILOGO:\n${totalText}\n\n📝 Lead ID: ${leadId}`;

      const whatsappUrl = generateWhatsAppLink(settings.whatsappNumber, message);
      window.open(whatsappUrl, "_blank");

      // Analytics
      if (analytics) {
        logEvent(analytics, "whatsapp_contact", {
          items: selectedItems.length,
          total_value: toNum(displayTotal),
          lead_id: leadId,
        });
      }

      toast({
        title: "WhatsApp aperto!",
        description: "Si è aperta la conversazione WhatsApp con i dettagli del preventivo.",
      });
    } catch (error) {
      console.error("Error generating WhatsApp message:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la generazione del messaggio WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!settings) return;

    setIsGeneratingPDF(true);
    try {
      const { customer, selectedItems, pricing } = leadData;

      // Generate PDF with proper data structure
      const individualSavings = toNum(pricing.detailed?.individualDiscountSavings || 0);
      const globalSavings = toNum(pricing.detailed?.globalDiscountSavings || 0);

      const pdfData = {
        customer,
        selectedItems,
        pricing: {
          ...pricing,
          // Critical fix: ensure PDF uses correct total
          total: displayTotal
        }
      };

      await generateClientQuotePDF(pdfData, settings.studioName || 'Studio');

      // Analytics
      if (analytics) {
        logEvent(analytics, "pdf_download", {
          items: selectedItems.length,
          total_value: toNum(displayTotal),
          lead_id: leadId,
        });
      }

      toast({
        title: "PDF generato!",
        description: "Il preventivo PDF è stato scaricato con successo.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la generazione del PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!settings) return null;

  // Calculate pricing summary for display
  const { pricing } = leadData;

  // Calculate pricing summary for display
  const individualSavings = toNum(pricing.detailed?.individualDiscountSavings || 0);
  const globalSavings = toNum(pricing.detailed?.globalDiscountSavings || 0);
  const giftSavings = toNum(pricing.giftSavings || 0);
  const totalSavings = toNum(pricing.totalSavings || 0);

  // Use the corrected total from unifiedPricing.ts
  const displayTotal = toNum(pricing.total);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-brand-primary border-2 border-brand-accent shadow-2xl">
        <DialogHeader className="text-center pb-6">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <DialogTitle className="text-3xl font-bold text-brand-accent mb-2">
            🎉 Preventivo Salvato!
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600">
            Il tuo preventivo è stato salvato correttamente nel nostro sistema.
          </DialogDescription>
        </DialogHeader>

        {/* Lead ID Card with Copy Functionality */}
        <Card className="border-2 border-brand-accent bg-gradient-to-br from-brand-accent/10 to-brand-accent/5 shadow-lg mb-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2 font-medium">ID Preventivo:</p>
              <div className="space-y-3">
                <p className="font-mono text-2xl font-bold text-brand-accent bg-white px-4 py-2 rounded-lg inline-block shadow-inner">
                  {leadId}
                </p>

                {/* Quote Link */}
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-gray-600">Link preventivo:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-brand-accent font-mono">
                    {window.location.pathname.replace(/\/[^\/]*$/, '')}/quote/{leadId}
                  </code>
                  <Button
                    onClick={() => {
                      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
                      const quoteUrl = `${window.location.origin}${basePath}/quote/${leadId}`;
                      navigator.clipboard.writeText(quoteUrl).then(() => {
                        toast({
                          title: "Link copiato!",
                          description: "Il link del preventivo è stato copiato negli appunti.",
                        });
                      });
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-brand-accent hover:bg-brand-accent/10"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
                      const quoteUrl = `${window.location.origin}${basePath}/quote/${leadId}`;
                      window.open(quoteUrl, '_blank');
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-brand-accent hover:bg-brand-accent/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                {/* Copy ID Button */}
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(leadId).then(() => {
                      toast({
                        title: "ID copiato!",
                        description: "L'ID del preventivo è stato copiato negli appunti.",
                      });
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs border-brand-accent text-brand-accent hover:bg-brand-accent/10"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copia ID
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Summary */}
        <Card className="border border-gray-200 bg-white shadow-lg mb-6">
          <CardContent className="pt-6">
            <h4 className="font-bold text-xl text-brand-accent mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2" />
              RIEPILOGO ECONOMICO
            </h4>

            <div className="space-y-3">
              {/* Selected Items */}
              <div className="space-y-2">
                {leadData.selectedItems.map((item, index) => {
                  const originalPrice = toNum(item.originalPrice);
                  const currentPrice = toNum(item.price);
                  const isGift = currentPrice === 0;
                  const hasDiscount = originalPrice > currentPrice && !isGift;

                  return (
                    <div key={index} className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-b-0">
                      <span className="font-medium">
                        {item.title}
                        {isGift && <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">OMAGGIO</span>}
                      </span>
                      <span className="font-semibold">
                        {isGift ? (
                          <>
                            {originalPrice > 0 && (
                              <span className="line-through text-gray-400 mr-2">€{formatEUR(originalPrice)}</span>
                            )}
                            <span className="text-green-600 font-bold">GRATIS</span>
                          </>
                        ) : hasDiscount ? (
                          <>
                            <span className="line-through text-gray-400 mr-2">€{formatEUR(originalPrice)}</span>
                            <span className="text-brand-accent">€{formatEUR(currentPrice)}</span>
                          </>
                        ) : (
                          <span className="text-brand-accent">€{formatEUR(currentPrice)}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <hr className="border-brand-secondary my-4" />

              {/* Pricing breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotale servizi/prodotti:</span>
                  <span className="font-semibold">€{formatEUR(pricing.subtotal)}</span>
                </div>

                {individualSavings > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Sconti per prodotto/servizio:</span>
                    <span className="font-semibold">-€{formatEUR(individualSavings)}</span>
                  </div>
                )}

                {globalSavings > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Sconto globale (-10%):</span>
                    <span className="font-semibold">-€{formatEUR(globalSavings)}</span>
                  </div>
                )}

                {giftSavings > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Servizi in omaggio:</span>
                    <span className="font-semibold">-€{formatEUR(giftSavings)}</span>
                  </div>
                )}

                {totalSavings > 0 && (
                  <div className="flex justify-between text-green-600 font-bold bg-green-50 px-3 py-2 rounded-lg mt-3">
                    <span>💰 Totale risparmiato:</span>
                    <span>€{formatEUR(totalSavings)}</span>
                  </div>
                )}
              </div>

              <hr className="border-brand-secondary my-4" />

              {/* Final Total */}
              <div className="flex justify-between items-center bg-gradient-to-r from-brand-accent/10 to-brand-accent/5 px-4 py-3 rounded-lg">
                <span className="text-xl font-bold text-brand-accent">TOTALE FINALE:</span>
                <span className="text-2xl font-bold text-brand-accent">€{formatEUR(displayTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-4">
          <p className="text-center text-gray-600 font-medium">
            Scegli come vuoi procedere:
          </p>

          <div className="grid gap-4">
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white py-4 text-lg font-semibold shadow-lg"
              size="lg"
            >
              <Download className="mr-3 h-5 w-5" />
              {isGeneratingPDF ? "Generando PDF..." : "📄 Scarica Preventivo PDF"}
            </Button>

            <Button
              onClick={handleWhatsAppShare}
              disabled={isSendingWhatsApp}
              variant="outline"
              className="w-full border-2 border-green-500 text-green-600 hover:bg-green-50 py-4 text-lg font-semibold shadow-lg"
              size="lg"
            >
              <MessageCircle className="mr-3 h-5 w-5" />
              {isSendingWhatsApp ? "Aprendo WhatsApp..." : "💬 Invia su WhatsApp"}
            </Button>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={() => {
                onClose(); // Close this modal first
                if (onBackToCheckout) {
                  setTimeout(() => onBackToCheckout(), 100); // Small delay to ensure clean modal transition
                }
              }}
              variant="outline"
              className="w-full text-brand-accent border-brand-accent hover:bg-brand-accent/10 py-3"
              size="sm"
            >
              ← Indietro al Preventivo
            </Button>

            {/* New button to start over */}
            <Button
              onClick={() => {
                onClose(); // Close this modal first
                if (onStartOver) {
                  setTimeout(() => onStartOver(), 100); // Small delay to ensure clean modal transition
                }
              }}
              variant="outline"
              className="w-full text-blue-600 border-blue-500 hover:bg-blue-50 py-3 border-2"
              size="sm"
            >
              🔄 Nuovo Preventivo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}