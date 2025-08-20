import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, MessageCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "@/lib/utils";
import { generateClientQuotePDF } from "@/lib/pdf";
import { generateWhatsAppLink } from "@/lib/whatsapp";
import { useLocation } from "wouter";

interface LeadData {
  id: string;
  customer: any;
  selectedItems: any[];
  pricing: any;
  createdAt: any;
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

export default function QuoteView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;

    const fetchLead = async () => {
      try {
        const leadDoc = await getDoc(doc(db, "leads", id));
        if (leadDoc.exists()) {
          const data = leadDoc.data();
          setLeadData({
            id: leadDoc.id,
            customer: data.customer || {},
            selectedItems: data.selectedItems || [],
            pricing: data.pricing || {},
            createdAt: data.createdAt
          });
        } else {
          setError("Preventivo non trovato");
        }
      } catch (err) {
        console.error("Error fetching lead:", err);
        setError("Errore nel caricamento del preventivo");
      } finally {
        setLoading(false);
      }
    };

    fetchLead();
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!leadData) return;

    setIsGeneratingPDF(true);
    try {
      const pdfData = {
        customer: leadData.customer,
        selectedItems: leadData.selectedItems,
        pricing: leadData.pricing
      };

      await generateClientQuotePDF(pdfData, 'Studio');

      toast({
        title: "PDF generato!",
        description: "Il preventivo è stato scaricato con successo.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Errore nella generazione PDF",
        description: "Si è verificato un problema durante la creazione del PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!leadData) return;

    setIsSendingWhatsApp(true);
    try {
      const { customer, selectedItems, pricing } = leadData;

      // Generate message content
      const customerName = customer.nome || customer.name || 'Cliente';
      const messageLines = [
        `🎉 Preventivo per ${customerName}`,
        "",
        "📋 SERVIZI SELEZIONATI:",
        ...selectedItems.map(item => {
          const originalPrice = toNum(item.originalPrice);
          const currentPrice = toNum(item.price);
          const isGift = currentPrice === 0;
          
          if (isGift) {
            return `• ${item.title} - OMAGGIO (€${formatEUR(originalPrice)})`;
          } else if (originalPrice > currentPrice) {
            return `• ${item.title} - €${formatEUR(currentPrice)} (era €${formatEUR(originalPrice)})`;
          } else {
            return `• ${item.title} - €${formatEUR(currentPrice)}`;
          }
        }),
        "",
        `💰 TOTALE: €${formatEUR(pricing.total)}`,
        "",
        `🔗 Link preventivo: ${window.location.href}`,
        "",
        "Contattaci per procedere con la prenotazione! 📞"
      ];

      const message = messageLines.join('\n');
      const whatsappUrl = generateWhatsAppLink("393274656179", message);
      window.open(whatsappUrl, "_blank");

      toast({
        title: "WhatsApp aperto!",
        description: "Il messaggio con il preventivo è pronto per essere inviato.",
      });
    } catch (error) {
      console.error("Error generating WhatsApp message:", error);
      toast({
        title: "Errore WhatsApp",
        description: "Si è verificato un problema nell'apertura di WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  if (error || !leadData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Preventivo Non Trovato
            </h1>
            <p className="text-gray-600 mb-6">
              {error || "Il preventivo richiesto non esiste o non è più disponibile."}
            </p>
            <Button 
              onClick={() => setLocation("/")}
              className="bg-brand-accent hover:bg-brand-accent/90"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna alla Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customer, selectedItems, pricing } = leadData;
  const individualSavings = toNum(pricing.detailed?.individualDiscountSavings || 0);
  const globalSavings = toNum(pricing.detailed?.globalDiscountSavings || 0);
  const giftSavings = toNum(pricing.giftSavings || 0);
  const totalSavings = toNum(pricing.totalSavings || 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/")}
            className="text-brand-accent border-brand-accent hover:bg-brand-accent/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna alla Home
          </Button>
          
          <div className="text-right">
            <p className="text-sm text-gray-600">Preventivo ID</p>
            <p className="font-mono text-lg font-bold text-brand-accent">{leadData.id}</p>
          </div>
        </div>

        {/* Customer Info */}
        <Card className="border border-gray-200 bg-white shadow-lg">
          <CardContent className="pt-6">
            <h3 className="font-bold text-lg text-brand-accent mb-4">
              Dati Cliente
            </h3>
            <div className="space-y-2 text-sm">
              {customer.nome && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Nome:</span>
                  <span className="font-medium">{customer.nome}</span>
                </div>
              )}
              {customer.cognome && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Cognome:</span>
                  <span className="font-medium">{customer.cognome}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{customer.email}</span>
                </div>
              )}
              {customer.telefono && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Telefono:</span>
                  <span className="font-medium">{customer.telefono}</span>
                </div>
              )}
              {customer.data_evento && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Evento:</span>
                  <span className="font-medium">{customer.data_evento}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Summary */}
        <Card className="border border-gray-200 bg-white shadow-lg">
          <CardContent className="pt-6">
            <h4 className="font-bold text-xl text-brand-accent mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2" />
              RIEPILOGO ECONOMICO
            </h4>
            
            <div className="space-y-3">
              {/* Selected Items */}
              <div className="space-y-2">
                {selectedItems.map((item, index) => {
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
                <span className="text-2xl font-bold text-brand-accent">€{formatEUR(pricing.total)}</span>
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
        </div>
      </div>
    </div>
  );
}