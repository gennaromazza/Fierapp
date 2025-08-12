import { useState, useEffect } from "react";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings, InsertLead } from "@shared/schema";
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
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { cart, clearCart, getPricingWithRules } = useCartWithRules();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Dynamic form schema based on settings
  const [formSchema, setFormSchema] = useState<z.ZodSchema<any>>(z.object({}));
  const [formDefaults, setFormDefaults] = useState<Record<string, any>>({});

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: formDefaults,
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          const settingsData = settingsDoc.data() as Settings;
          setSettings(settingsData);
          
          // Create dynamic form schema and defaults
          const schemaFields: Record<string, any> = {};
          const defaults: Record<string, any> = {};
          
          settingsData.formFields.forEach(field => {
            const fieldName = field.label.toLowerCase().replace(/\s+/g, '_');
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
              defaults[fieldName] = "";
            } else {
              defaults[fieldName] = "";
            }
            
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
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }
    
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, form]);



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

      // Prepare lead data with correct schema structure
      const leadData: InsertLead = {
        customer: data,
        selectedItems: cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: getPricingWithRules(),
        gdprConsent: {
          accepted: data.gdpr_consent || false,
          text: settings.gdprText,
          timestamp: new Date()
        },
        reCAPTCHAToken: recaptchaToken || undefined,
        status: "new"
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, "leads"), leadData);
      console.log("Lead saved successfully with ID:", docRef.id);
      
      // Analytics
      const pricing = getPricingWithRules();
      if (analytics) {
        logEvent(analytics, 'form_submit', {
          form_id: 'checkout_form',
          lead_id: docRef.id,
          total_value: pricing.total
        });
      }

      // Create detailed WhatsApp message with form data
      if (settings.whatsappNumber) {
        const cartSummary = cart.items.map(item => 
          `• ${item.title} - €${item.price.toLocaleString('it-IT')}`
        ).join('\n');
        
        // Format form data for WhatsApp
        const formDataText = Object.entries(data)
          .filter(([key, value]) => key !== 'gdpr_consent' && value)
          .map(([key, value]) => {
            const label = settings.formFields.find(field => 
              field.label.toLowerCase().replace(/\s+/g, '_') === key
            )?.label || key;
            return `${label}: ${value}`;
          })
          .join('\n');
        
        const pricing = getPricingWithRules();
        const totalText = pricing.totalSavings > 0 
          ? `Subtotale: €${pricing.originalSubtotal.toLocaleString('it-IT')}\nSconto: -€${pricing.totalSavings.toLocaleString('it-IT')}\nTotale: €${pricing.total.toLocaleString('it-IT')}`
          : `Totale: €${pricing.total.toLocaleString('it-IT')}`;
        
        const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${cartSummary}\n\n💰 RIEPILOGO:\n${totalText}\n\n📝 Lead ID: ${docRef.id}`;
        
        const whatsappUrl = generateWhatsAppLink(settings.whatsappNumber, message);
        window.open(whatsappUrl, '_blank');
        
        // Analytics for WhatsApp  
        if (analytics) {
          logEvent(analytics, 'whatsapp_contact', {
            items: cart.items.length,
            total_value: pricing.total,
            lead_id: docRef.id
          });
        }
      }

      toast({
        title: "Richiesta inviata con successo!",
        description: "I tuoi dati sono stati salvati e si è aperta la conversazione WhatsApp. Ti contatteremo al più presto!",
      });

      // Clear cart and close modal
      clearCart();
      onClose();
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
    
    setIsGeneratingPDF(true);
    try {
      const formData = form.getValues();
      
      // Prepare data structure similar to lead data
      const pdfData = {
        customer: formData,
        selectedItems: cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: getPricingWithRules()
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

  if (cart.itemCount === 0) return null;

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
          
        {/* Selected Items Summary */}
        <div className="bg-brand-primary rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-brand-accent mb-3">RIEPILOGO SELEZIONE</h4>
          <div className="space-y-2 text-sm">
            {cart.cart.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span>
                  {item.title}
                  {cart.isItemGift && cart.isItemGift(item.id) && (
                    <span className="ml-1 text-green-600 font-bold">(OMAGGIO)</span>
                  )}
                </span>
                <span>
                  {cart.isItemGift && cart.isItemGift(item.id) ? (
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
              const pricing = getPricingWithRules();
              return (
                <>
                  <hr className="border-brand-secondary" />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotale servizi/prodotti:</span>
                    <span>€{pricing.subtotal.toLocaleString('it-IT')}</span>
                  </div>
                  
                  {pricing.totalSavings > 0 && (
                    <>
                      {pricing.discount > 0 && (
                        <div className="flex justify-between text-green-600 font-semibold">
                          <span>Sconti applicati:</span>
                          <span>-€{Math.round(pricing.discount).toLocaleString('it-IT')}</span>
                        </div>
                      )}
                      {pricing.giftSavings > 0 && (
                        <div className="flex justify-between text-green-600 font-semibold">
                          <span>Omaggi:</span>
                          <span>-€{Math.round(pricing.giftSavings).toLocaleString('it-IT')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-green-600 font-bold text-base">
                        <span>RISPARMIO TOTALE:</span>
                        <span>-€{Math.round(pricing.totalSavings).toLocaleString('it-IT')}</span>
                      </div>
                    </>
                  )}
                  
                  <hr className="border-brand-secondary" />
                  <div className="flex justify-between font-bold text-lg text-brand-accent">
                    <span>TOTALE</span>
                    <span>€{Math.round(pricing.total).toLocaleString('it-IT')}</span>
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
        

      </DialogContent>
    </Dialog>
  );
}