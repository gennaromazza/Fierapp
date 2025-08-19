import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings } from "@shared/schema";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { generateClientQuotePDF } from "../lib/pdf";
import { MessageCircle, Download, CheckCircle } from "lucide-react";
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
  leadId: string;
  leadData: {
    customer: any;
    selectedItems: any[];
    pricing: any;
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
  leadId,
  leadData,
}: ConfirmQuoteModalProps) {
  const { toast } = useToast();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Fetch settings from Firebase
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const settingsDoc = await getDoc(doc(db, "settings", "main"));
      return settingsDoc.exists() ? (settingsDoc.data() as Settings) : null;
    },
  });

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
            (f) => f.label.toLowerCase().replace(/\s+/g, "_") === key,
          );
          const label = field?.label || key;
          return `${label}: ${value}`;
        })
        .filter(Boolean)
        .join("\n");

      // Generate pricing breakdown
      const lines = [
        `Subtotale servizi/prodotti: €${formatEUR(pricing.subtotal)}`,
        ...(toNum(pricing.detailed?.individualDiscountSavings) > 0
          ? [`Sconti per prodotto/servizio: -€${formatEUR(pricing.detailed.individualDiscountSavings)}`]
          : []),
        ...(toNum(pricing.detailed?.globalDiscountSavings) > 0
          ? [`Sconto globale (-10%): -€${formatEUR(pricing.detailed.globalDiscountSavings)}`]
          : []),
        ...(toNum(pricing.giftSavings) > 0
          ? [`Servizi in omaggio: -€${formatEUR(pricing.giftSavings)}`]
          : []),
        `TOTALE: €${formatEUR(pricing.total)}`,
        ...(toNum(pricing.totalSavings) > 0
          ? [`💰 Totale risparmiato: €${formatEUR(pricing.totalSavings)}!`]
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
          total_value: toNum(pricing.total),
          lead_id: leadId,
        });
      }

      toast({
        title: "WhatsApp aperto!",
        description: "Si è aperta la conversazione WhatsApp con i dettagli del preventivo.",
      });

      onClose();
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

      // Generate PDF with lead data
      const pdfData = {
        customer,
        selectedItems,
        pricing: {
          ...pricing,
          // Ensure compatibility with PDF generation
          discount: pricing.detailed?.individualDiscountSavings + pricing.detailed?.globalDiscountSavings || 0,
          originalSubtotal: pricing.subtotal + (pricing.detailed?.individualDiscountSavings || 0)
        }
      };

      await generateClientQuotePDF(pdfData, settings.studioName || 'Studio');

      // Analytics
      if (analytics) {
        logEvent(analytics, "pdf_download", {
          items: selectedItems.length,
          total_value: toNum(pricing.total),
          lead_id: leadId,
        });
      }

      toast({
        title: "PDF generato!",
        description: "Il preventivo PDF è stato scaricato con successo.",
      });

      onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle>Preventivo Salvato!</DialogTitle>
          <DialogDescription>
            Il tuo preventivo è stato salvato correttamente nel nostro sistema.
          </DialogDescription>
        </DialogHeader>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">ID Preventivo:</p>
              <p className="font-mono text-lg font-semibold text-green-800">{leadId}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-center text-sm text-gray-600">
            Scegli come vuoi procedere:
          </p>

          <div className="grid gap-3">
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              {isGeneratingPDF ? "Generando PDF..." : "Scarica Preventivo PDF"}
            </Button>

            <Button
              onClick={handleWhatsAppShare}
              disabled={isSendingWhatsApp}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {isSendingWhatsApp ? "Aprendo WhatsApp..." : "Invia su WhatsApp"}
            </Button>
          </div>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full"
            size="sm"
          >
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}