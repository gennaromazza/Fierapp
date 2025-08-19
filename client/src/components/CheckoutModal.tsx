import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings } from "@shared/schema";
import { saveLead } from "../lib/leadSaver";
import { labelToFieldName, mapLeadDataToFormField, formatFieldForDisplay } from "../lib/fieldMappingHelper";
import { useCartWithRules } from "../hooks/useCartWithRules";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { generateClientQuotePDF } from "../lib/pdf";
import { MessageCircle, Download } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

// Utility function moved to centralized leadSaver.ts

export default function CheckoutModal({ isOpen, onClose, leadData }: CheckoutModalProps) {
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
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['settings', 'app'],
    queryFn: async () => {
      console.log('🔄 CheckoutModal - Fetching settings from Firebase...');
      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      
      if (!settingsDoc.exists()) {
        console.warn('⚠️ Settings document does not exist');
        return null;
      }

      const data = settingsDoc.data();
      console.log('✅ CheckoutModal - Settings loaded successfully');
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

    console.log('🔄 CheckoutModal - Creating form schema from cached settings');

    // Create dynamic form schema and defaults
    const schemaFields: Record<string, any> = {};
    const defaults: Record<string, any> = {};

    settings.formFields.forEach(field => {
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
      const defaultValue = leadData ? mapLeadDataToFormField(leadData, fieldName) : "";

      defaults[fieldName] = defaultValue;
      schemaFields[fieldName] = fieldSchema;
    });

    // Add GDPR consent
    schemaFields.gdpr_consent = z.boolean().refine(val => val === true, {
      message: "Devi accettare il trattamento dei dati personali"
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
          recaptchaToken = await window.grecaptcha.execute(settings.reCAPTCHASiteKey, { action: 'submit' });
        } catch (error) {
          console.error("reCAPTCHA error:", error);
        }
      }

      // Use centralized save function
      const leadId = await saveLead({
        customer: data,
        selectedItems: cartWithRules.cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: cartWithRules.getPricingWithRules(),
        gdprConsent: {
          accepted: data.gdpr_consent || false,
          text: settings.gdprText,
          timestamp: new Date()
        },
        reCAPTCHAToken: recaptchaToken || undefined,
        status: "new"
      });

      // Use unified pricing for analytics
      const unifiedPricing = cartWithRules.getPricingWithRules();
      // Analytics
      if (analytics) {
        logEvent(analytics, 'form_submit', {
          form_id: 'checkout_form',
          lead_id: leadId,
          total_value: unifiedPricing.total
        });
      }

      // Create detailed WhatsApp message with form data
      if (settings.whatsappNumber) {
        const cartSummary = cartWithRules.cart.items.map(item => 
          `• ${item.title} - €${item.price.toLocaleString('it-IT')}`
        ).join('\n');

        // Format form data for WhatsApp using centralized helper
        const formDataText = Object.entries(data)
          .filter(([key, value]) => key !== 'gdpr_consent' && value)
          .map(([key, value]) => {
            const field = settings.formFields.find(field => 
              labelToFieldName(field.label) === key
            );
            return formatFieldForDisplay(key, value, field?.label);
          })
          .filter(Boolean)
          .join('\n');

        const pricing = cartWithRules.getPricingWithRules();
        const totalText = pricing.discount > 0 
          ? `Subtotale: €${pricing.originalSubtotal.toLocaleString('it-IT')}\nSconto: -€${pricing.discount.toLocaleString('it-IT')}\nTotale: €${pricing.total.toLocaleString('it-IT')}`
          : `Totale: €${pricing.total.toLocaleString('it-IT')}`;

        const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${cartSummary}\n\n💰 RIEPILOGO:\n${totalText}\n\n📝 Lead ID: ${leadId}`;

        const whatsappUrl = generateWhatsAppLink(settings.whatsappNumber, message);
        window.open(whatsappUrl, '_blank');

        // Analytics for WhatsApp  
        if (analytics) {
          logEvent(analytics, 'whatsapp_contact', {
            items: cartWithRules.cart.items.length,
            total_value: pricing.total,
            lead_id: leadId
          });
        }
      }

      toast({
        title: "Richiesta inviata con successo!",
        description: "I tuoi dati sono stati salvati e si è aperta la conversazione WhatsApp. Ti contatteremo al più presto!",
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
        description: "Si è verificato un errore durante l'invio. Riprova più tardi.",
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
        description: "Aggiungi almeno un servizio per generare il preventivo PDF",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const formData = form.getValues();

      // Prepare data structure similar to lead data
      const pdfData = {
        customer: formData,
        selectedItems: cartWithRules.cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: cartWithRules.getPricingWithRules()
      };

      const customerName = formData.nome || formData.Nome || 'cliente';
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
          <DialogTitle className="text-2xl font-bold text-brand-accent">RICHIEDI INFORMAZIONI</DialogTitle>
          <DialogDescription id="checkout-description">
            Compila il form per ricevere un preventivo personalizzato per i servizi selezionati.
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
            <p className="text-red-600">Errore nel caricamento delle impostazioni. Riprova più tardi.</p>
          </div>
        )}

        {!settingsLoading && !settingsError && !settings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-600">Configurazione non trovata. Contatta l'amministratore.</p>
          </div>
        )}

        {/* Main Content - Show only when settings are loaded */}
        {!settingsLoading && !settingsError && settings && (
          <>
            {/* Selected Items Summary */}
            <div className="bg-brand-primary rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-brand-accent mb-3">RIEPILOGO SELEZIONE</h4>
              <div className="space-y-2 text-sm">
            {cartWithRules.cart.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span>
                  {item.title}
                  {cartWithRules.isItemGift && cartWithRules.isItemGift(item.id) && (
                    <span className="ml-1 text-green-600 font-bold">(OMAGGIO)</span>
                  )}
                </span>
                <span>
                  {cartWithRules.isItemGift && cartWithRules.isItemGift(item.id) ? (
                    <>
                      <span className="line-through text-gray-400 mr-2">€{item.price.toLocaleString('it-IT')}</span>
                      <span className="text-green-600 font-bold">GRATIS</span>
                    </>
                  ) : (
                    `€${item.price.toLocaleString('it-IT')}`
                  )}
                </span>
              </div>
            ))}

            {(() => {
              const unifiedPricing = cartWithRules.getPricingWithRules();

              return (
                <>
                  <hr className="border-brand-secondary" />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotale servizi/prodotti:</span>
                    <span>€{Math.round(unifiedPricing.originalSubtotal).toLocaleString('it-IT')}</span>
                  </div>

                  {unifiedPricing.discount > 0 && (
                    <div className="flex justify-between text-orange-600 font-semibold">
                      <span>Sconto applicato:</span>
                      <span>-€{Math.round(unifiedPricing.discount).toLocaleString('it-IT')}</span>
                    </div>
                  )}

                  {unifiedPricing.giftSavings > 0 && (
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Servizi in omaggio:</span>
                      <span>-€{Math.round(unifiedPricing.giftSavings).toLocaleString('it-IT')}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-lg text-brand-accent">
                    <span>TOTALE</span>
                    <span>€{Math.round(Math.max(0, unifiedPricing.originalSubtotal - unifiedPricing.discount - unifiedPricing.giftSavings)).toLocaleString('it-IT')}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Dynamic Form */}
        {settings && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings.formFields.map((field, index) => {
                const fieldName = field.label.toLowerCase().replace(/\s+/g, '_');

                return (
                  <div key={index} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        {...form.register(fieldName)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none"
                      />
                    ) : field.type === 'select' && field.options ? (
                      <select
                        {...form.register(fieldName)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                      >
                        <option value="">Seleziona...</option>
                        {field.options.map((option, optIndex) => (
                          <option key={optIndex} value={option}>{option}</option>
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
                        {form.formState.errors[fieldName]?.message as string}
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
                  {...form.register('gdpr_consent')}
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
                Questo sito è protetto da reCAPTCHA e si applicano la Privacy Policy e i Termini di Servizio di Google.
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 space-y-3">
              {/* Download PDF Button */}
              <Button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF || !form.watch('gdpr_consent')}
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
                disabled={isSubmitting || !form.watch('gdpr_consent')}
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
                  La richiesta verrà salvata e si aprirà automaticamente WhatsApp
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