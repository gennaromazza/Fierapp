import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings } from "@shared/schema";
import { saveLead } from "../lib/leadSaver";
import {
  labelToFieldName,
  mapLeadDataToFormField,
  formatFieldForDisplay,
} from "../lib/fieldMappingHelper";
import { useCartWithRules } from "../hooks/useCartWithRules";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { generateClientQuotePDF } from "../lib/pdf";
import { MessageCircle, Download } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Add global type for reCAPTCHA
declare global {
  interface Window {
    grecaptcha: {
      execute(siteKey: string, options: { action: string }): Promise<string>;
    };
  }
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadData?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: string;
    eventDate?: string;
    notes?: string;
  };
}

// ===== Helpers di formattazione sicura =====
const toNum = (n: unknown) => {
  const v = typeof n === "string" ? Number(n) : (n as number);
  return Number.isFinite(v) ? (v as number) : 0;
};
const formatEUR = (n: unknown) =>
  toNum(n).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CheckoutModal({
  isOpen,
  onClose,
  leadData,
}: CheckoutModalProps) {
  const cartWithRules = useCartWithRules();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [allowEmptyCart, setAllowEmptyCart] = useState(false);

  // Reset allowEmptyCart when modal opens with items
  useEffect(() => {
    if (isOpen && cartWithRules.cart.itemCount > 0) {
      setAllowEmptyCart(false);
    }
  }, [isOpen, cartWithRules.cart.itemCount]);

  // Use React Query for cached settings loading
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useQuery({
    queryKey: ["settings", "app"],
    queryFn: async () => {
      console.log("🔄 CheckoutModal - Fetching settings from Firebase...");
      const settingsDoc = await getDoc(doc(db, "settings", "app"));

      if (!settingsDoc.exists()) {
        console.warn("⚠️ Settings document does not exist");
        return null;
      }

      const data = settingsDoc.data();
      console.log("✅ CheckoutModal - Settings loaded successfully");
      return data as Settings;
    },
    staleTime: 30000, // Cache for 30 seconds
    retry: 3,
  });

  // Dynamic form schema based on settings
  const [formSchema, setFormSchema] = useState<z.ZodSchema<any>>(z.object({}));
  const [formDefaults, setFormDefaults] = useState<Record<string, any>>({});

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: formDefaults,
  });

  // Update form schema when settings are loaded
  useEffect(() => {
    if (!isOpen || !settings) return;

    console.log("🔄 CheckoutModal - Creating form schema from cached settings");

    // Create dynamic form schema and defaults
    const schemaFields: Record<string, any> = {};
    const defaults: Record<string, any> = {};

    (settings.formFields ?? []).forEach((field) => {
      const fieldName = labelToFieldName(field.label);
      let fieldSchema: any;

      switch (field.type) {
        case "email":
          fieldSchema = z.string().email("Email non valida");
          break;
        case "tel":
          fieldSchema = z.string().min(1, "Telefono richiesto");
          break;
        case "date":
          fieldSchema = z.string().min(1, "Data richiesta");
          break;
        default:
          fieldSchema = z.string();
      }

      if (field.required) {
        fieldSchema = fieldSchema.min(1, `${field.label} richiesto`);
      }

      // Use centralized mapping for leadData precompilation
      const defaultValue = leadData
        ? mapLeadDataToFormField(leadData, fieldName)
        : "";

      defaults[fieldName] = defaultValue;
      schemaFields[fieldName] = fieldSchema;
    });

    // Add GDPR consent
    schemaFields.gdpr_consent = z.boolean().refine((val) => val === true, {
      message: "Devi accettare il trattamento dei dati personali",
    });
    defaults.gdpr_consent = false;

    const schema = z.object(schemaFields);
    setFormSchema(schema);
    setFormDefaults(defaults);

    // Reset form with new schema and defaults
    form.reset(defaults);
  }, [isOpen, settings, leadData, form]);

  const onSubmit = async (data: any) => {
    if (!settings) return;

    try {
      setIsSubmitting(true);

      // Get reCAPTCHA token if configured
      let recaptchaToken = null;
      if (settings.reCAPTCHASiteKey && window.grecaptcha) {
        try {
          recaptchaToken = await window.grecaptcha.execute(
            settings.reCAPTCHASiteKey,
            { action: "submit" },
          );
        } catch (error) {
          console.error("reCAPTCHA error:", error);
        }
      }

      // Use centralized save function
      const leadId = await saveLead({
        customer: data,
        selectedItems: cartWithRules.cart.items.map((item) => ({
          id: item.id,
          title: item.title,
          price: toNum(item.price),
          originalPrice: toNum(item.originalPrice),
        })),
        pricing: cartWithRules.getPricingWithRules(),
        gdprConsent: {
          accepted: data.gdpr_consent || false,
          text: settings.gdprText,
          timestamp: new Date(),
        },
        reCAPTCHAToken: recaptchaToken || undefined,
        status: "new",
      });

      // Pricing unificato per analytics e messaggi
      const p = cartWithRules.getPricingWithRules();

      // Analytics - submit
      if (analytics) {
        logEvent(analytics, "form_submit", {
          form_id: "checkout_form",
          lead_id: leadId,
          total_value: toNum(p.total),
        });
      }

      // WhatsApp message
      if (settings.whatsappNumber) {
        const items = cartWithRules.getItemsWithRuleInfo();
        const itemsList = items
          .map((it) => {
            const title = it.title ?? "Voce";
            const priceNum = toNum((it as any).price);
            const originalNum = toNum((it as any).originalPrice);
            const priceText = it.isGift ? "GRATIS" : `€${formatEUR(priceNum)}`;
            // Se scontato e non omaggio, mostra barrato
            if (!it.isGift && originalNum > priceNum) {
              return `• ${title} - ~€${formatEUR(originalNum)}~  €${formatEUR(priceNum)}`;
            }
            // Se omaggio e ho un originale, mostra barrato + GRATIS
            if (it.isGift && originalNum > 0) {
              return `• ${title} - ~€${formatEUR(originalNum)}~  GRATIS`;
            }
            return `• ${title} - ${priceText}`;
          })
          .join("\n");

        // Format form data for WhatsApp using centralized helper
        const formDataText = Object.entries(data)
          .filter(([key, value]) => key !== "gdpr_consent" && value)
          .map(([key, value]) => {
            const field = (settings.formFields ?? []).find(
              (f) => labelToFieldName(f.label) === key,
            );
            return formatFieldForDisplay(key, value, field?.label);
          })
          .filter(Boolean)
          .join("\n");

        const lines = [
          `Subtotale: €${formatEUR(p.originalSubtotal)}`,
          ...(toNum(p.discount) > 0
            ? [`Sconti: -€${formatEUR(p.discount)}`]
            : []),
          ...(toNum(p.giftSavings) > 0
            ? [`Servizi gratuiti: -€${formatEUR(p.giftSavings)}`]
            : []),
          `Totale: €${formatEUR(p.total)}`,
        ];
        const totalText = lines.join("\n");

        const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${itemsList}\n\n💰 RIEPILOGO:\n${totalText}\n\n📝 Lead ID: ${leadId}`;

        const whatsappUrl = generateWhatsAppLink(
          settings.whatsappNumber,
          message,
        );
        window.open(whatsappUrl, "_blank");

        // Analytics for WhatsApp
        if (analytics) {
          logEvent(analytics, "whatsapp_contact", {
            items: cartWithRules.cart.items.length,
            total_value: toNum(p.total),
            lead_id: leadId,
          });
        }
      }

      toast({
        title: "Richiesta inviata con successo!",
        description:
          "I tuoi dati sono stati salvati e si è aperta la conversazione WhatsApp. Ti contatteremo al più presto!",
      });

      // Allow modal to stay open with empty cart momentarily for confirmation
      setAllowEmptyCart(true);
      cartWithRules.clearCart();

      // Close modal after a brief delay to show the success message
      setTimeout(() => {
        setAllowEmptyCart(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Errore",
        description:
          "Si è verificato un errore durante l'invio. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!settings) return;

    // Prevent PDF generation if cart is empty
    if (cartWithRules.cart.itemCount === 0) {
      toast({
        title: "Carrello vuoto",
        description:
          "Aggiungi almeno un servizio per generare il preventivo PDF",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const formData = form.getValues();
      
      // Usa la stessa logica del display CheckoutModal per il PDF
      const itemsWithRules = cartWithRules.getItemsWithRuleInfo();
      const allItemsWithAvailability = cartWithRules.getAllItemsWithAvailability();
      
      // Calcola i totali usando i dati reali dal database (come nel CheckoutModal)
      let subtotalFromDB = 0;
      let totalIndividualDiscounts = 0;
      let giftSavingsFromDB = 0;
      
      const selectedItems = itemsWithRules.map(cartItem => {
        // Trova i dati completi dal database
        const fullItem = allItemsWithAvailability.find(dbItem => dbItem.id === cartItem.id);
        
        const title = fullItem?.title || cartItem.title || "Voce";
        const originalPrice = toNum(fullItem?.originalPrice || fullItem?.price || cartItem.price);
        const currentPrice = toNum(fullItem?.price || cartItem.price);
        const isGift = cartItem.isGift;
        
        if (isGift) {
          giftSavingsFromDB += originalPrice;
        } else {
          subtotalFromDB += currentPrice;
          if (originalPrice > currentPrice) {
            totalIndividualDiscounts += (originalPrice - currentPrice);
          }
        }
        
        return {
          id: cartItem.id,
          title: title,
          price: isGift ? 0 : currentPrice,
          originalPrice: originalPrice,
          isGift: isGift
        };
      });
      
      // Sconto globale sui prezzi già scontati dal database
      const globalDiscountRate = 0.1; // 10%
      const globalDiscountAmount = subtotalFromDB * globalDiscountRate;
      const finalTotal = subtotalFromDB - globalDiscountAmount;

      // Struttura dati per PDF allineata con il CheckoutModal
      const pdfData = {
        customer: formData,
        selectedItems: selectedItems,
        pricing: {
          subtotal: subtotalFromDB,
          individualDiscountSavings: totalIndividualDiscounts,
          globalDiscountSavings: globalDiscountAmount,
          giftSavings: giftSavingsFromDB,
          totalSavings: totalIndividualDiscounts + globalDiscountAmount + giftSavingsFromDB,
          total: finalTotal,
          // Mantieni compatibilità con vecchio sistema
          discount: totalIndividualDiscounts + globalDiscountAmount,
          originalSubtotal: subtotalFromDB + totalIndividualDiscounts
        }
      };

      const customerName = (
        formData.nome ||
        formData.Nome ||
        "cliente"
      ).toString();
      const filename = `preventivo-${customerName}-${new Date().toISOString().slice(0, 10)}.pdf`;

      await generateClientQuotePDF(pdfData, filename);

      toast({
        title: "PDF generato",
        description: "Il preventivo è stato scaricato con successo",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Errore",
        description: "Errore durante la generazione del PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Only hide modal if cart is empty AND we don't allow empty cart state
  if (cartWithRules.cart.itemCount === 0 && !allowEmptyCart) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-brand-primary"
        aria-describedby="checkout-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-brand-accent">
            RICHIEDI INFORMAZIONI
          </DialogTitle>
          <DialogDescription id="checkout-description">
            Compila il form per ricevere un preventivo personalizzato per i
            servizi selezionati.
          </DialogDescription>
        </DialogHeader>

        {/* Loading and Error States */}
        {settingsLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-brand-accent border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Caricamento configurazione...</p>
            </div>
          </div>
        )}

        {settingsError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600">
              Errore nel caricamento delle impostazioni. Riprova più tardi.
            </p>
          </div>
        )}

        {!settingsLoading && !settingsError && !settings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-600">
              Configurazione non trovata. Contatta l'amministratore.
            </p>
          </div>
        )}

        {/* Main Content - Show only when settings are loaded */}
        {!settingsLoading && !settingsError && settings && (
          <>
            {/* Selected Items Summary */}
            <div className="bg-brand-primary rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-brand-accent mb-3">
                RIEPILOGO SELEZIONE
              </h4>
              <div className="space-y-2 text-sm">
                {(() => {
                  // Usa il sistema unificato come la chat
                  const p = cartWithRules.getPricingWithRules();
                  const itemsWithRules = cartWithRules.getItemsWithRuleInfo();
                  const allItemsWithAvailability = cartWithRules.getAllItemsWithAvailability();

                  return (
                    <>
                      {/* Lista item con prezzi dal database (originalPrice e price) */}
                      {itemsWithRules.map((cartItem: any) => {
                        // Trova i dati completi dal database
                        const fullItem = allItemsWithAvailability.find(dbItem => dbItem.id === cartItem.id);
                        
                        const title = fullItem?.title || cartItem.title || "Voce";
                        const originalPrice = toNum(fullItem?.originalPrice || fullItem?.price || cartItem.price);
                        const currentPrice = toNum(fullItem?.price || cartItem.price);
                        const isGift = cartItem.isGift;
                        const hasDiscount = originalPrice > currentPrice && !isGift;

                        return (
                          <div key={cartItem.id} className="flex justify-between text-sm">
                            <span>
                              {title}
                              {isGift && <span className="ml-1 text-green-600 font-bold">(OMAGGIO)</span>}
                            </span>
                            <span>
                              {isGift ? (
                                <>
                                  {originalPrice > 0 && <span className="line-through text-gray-400 mr-2">€{formatEUR(originalPrice)}</span>}
                                  <span className="text-green-600 font-bold">GRATIS</span>
                                </>
                              ) : hasDiscount ? (
                                <>
                                  <span className="line-through text-gray-400 mr-2">€{formatEUR(originalPrice)}</span>
                                  <span className="text-green-600 font-semibold">€{formatEUR(currentPrice)}</span>
                                </>
                              ) : (
                                <>€{formatEUR(currentPrice)}</>
                              )}
                            </span>
                          </div>
                        );
                      })}

                      <hr className="border-brand-secondary" />

                      {(() => {
                        // Calcola manualmente i totali basati sui prezzi dal database
                        let subtotalFromDB = 0;
                        let totalIndividualDiscounts = 0;
                        let giftSavingsFromDB = 0;
                        
                        itemsWithRules.forEach(cartItem => {
                          const fullItem = allItemsWithAvailability.find(dbItem => dbItem.id === cartItem.id);
                          const originalPrice = toNum(fullItem?.originalPrice || fullItem?.price || cartItem.price);
                          const currentPrice = toNum(fullItem?.price || cartItem.price);
                          
                          if (cartItem.isGift) {
                            // Gli item regalo contribuiscono ai savings ma non al subtotale
                            giftSavingsFromDB += originalPrice;
                          } else {
                            // Item normali: usano il prezzo dal database
                            subtotalFromDB += currentPrice;
                            if (originalPrice > currentPrice) {
                              totalIndividualDiscounts += (originalPrice - currentPrice);
                            }
                          }
                        });
                        
                        // Sconto globale solo sui prezzi già scontati dal database (non sui regali)
                        const globalDiscountRate = 0.1; // 10%
                        const globalDiscountAmount = subtotalFromDB * globalDiscountRate;
                        const finalTotal = subtotalFromDB - globalDiscountAmount;
                        
                        return (
                          <>
                            <div className="flex justify-between text-sm text-gray-600">
                              <span>Subtotale servizi/prodotti:</span>
                              <span>€{formatEUR(subtotalFromDB)}</span>
                            </div>

                            {totalIndividualDiscounts > 0 && (
                              <div className="flex justify-between text-blue-600 font-semibold">
                                <span>Sconti per prodotto/servizio:</span>
                                <span>-€{formatEUR(totalIndividualDiscounts)}</span>
                              </div>
                            )}

                            {globalDiscountAmount > 0 && (
                              <div className="flex justify-between text-orange-600 font-semibold">
                                <span>Sconto globale (-10%):</span>
                                <span>-€{formatEUR(globalDiscountAmount)}</span>
                              </div>
                            )}

                            {giftSavingsFromDB > 0 && (
                              <div className="flex justify-between text-green-600 font-semibold">
                                <span>Servizi in omaggio:</span>
                                <span>-€{formatEUR(giftSavingsFromDB)}</span>
                              </div>
                            )}

                            {(totalIndividualDiscounts + globalDiscountAmount + giftSavingsFromDB) > 0 && (
                              <div className="flex justify-between text-gray-600 text-sm border-t border-gray-200 pt-2 mt-2">
                                <span>Totale risparmi:</span>
                                <span className="font-semibold">-€{formatEUR(totalIndividualDiscounts + globalDiscountAmount + giftSavingsFromDB)}</span>
                              </div>
                            )}

                            <div className="flex justify-between font-bold text-lg text-brand-accent">
                              <span>TOTALE</span>
                              <span>€{formatEUR(finalTotal)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Dynamic Form */}
            {settings && (
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(settings.formFields ?? []).map((field, index) => {
                    const fieldName = labelToFieldName(field.label);

                    return (
                      <div
                        key={index}
                        className={
                          field.type === "textarea" ? "md:col-span-2" : ""
                        }
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label} {field.required && "*"}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            {...form.register(fieldName)}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none"
                          />
                        ) : field.type === "select" && field.options ? (
                          <select
                            {...form.register(fieldName)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                          >
                            <option value="">Seleziona...</option>
                            {field.options.map((option, optIndex) => (
                              <option key={optIndex} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            {...form.register(fieldName)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                          />
                        )}
                        {form.formState.errors[fieldName] && (
                          <p className="mt-1 text-sm text-red-600">
                            {
                              form.formState.errors[fieldName]
                                ?.message as string
                            }
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* GDPR Consent */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      {...form.register("gdpr_consent")}
                      className="mt-1 w-5 h-5 text-brand-accent border-gray-300 rounded focus:ring-brand-accent"
                    />
                    <span className="text-sm text-gray-700">
                      {settings.gdprText} *
                    </span>
                  </label>
                  {form.formState.errors.gdpr_consent && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.gdpr_consent?.message as string}
                    </p>
                  )}
                </div>

                {/* reCAPTCHA Notice */}
                {settings.reCAPTCHASiteKey && (
                  <div className="text-xs text-gray-500 text-center">
                    Questo sito è protetto da reCAPTCHA e si applicano la
                    Privacy Policy e i Termini di Servizio di Google.
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 space-y-3">
                  {/* Download PDF Button */}
                  <Button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPDF || !form.watch("gdpr_consent")}
                    className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <span>Generando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>SCARICA PREVENTIVO PDF</span>
                      </>
                    )}
                  </Button>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting || !form.watch("gdpr_consent")}
                    className="w-full flex items-center justify-center space-x-2 bg-brand-accent text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <span>Invio in corso...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-5 h-5" />
                        <span>INVIA RICHIESTA</span>
                      </>
                    )}
                  </Button>
                  {settings?.whatsappNumber && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      La richiesta verrà salvata e si aprirà automaticamente
                      WhatsApp
                    </p>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
