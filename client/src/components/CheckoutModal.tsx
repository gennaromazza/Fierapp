import { useState, useEffect } from "react";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings, InsertLead } from "@shared/schema";
import { useCart } from "../hooks/useCart";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { MessageCircle } from "lucide-react";
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
  const { cart, clearCart } = useCart();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleWhatsAppShare = () => {
    if (!settings?.whatsappNumber) {
      toast({
        title: "Errore",
        description: "Numero WhatsApp non configurato",
        variant: "destructive",
      });
      return;
    }

    const cartSummary = cart.items.map(item => 
      `• ${item.title} - €${item.price.toLocaleString('it-IT')}`
    ).join('\n');
    
    const message = `Ciao! Sono interessato/a ai seguenti servizi:\n\n${cartSummary}\n\nTotale: €${cart.total.toLocaleString('it-IT')}\n\nPuoi inviarmi maggiori informazioni? Grazie!`;
    
    const whatsappUrl = generateWhatsAppLink(settings.whatsappNumber, message);
    window.open(whatsappUrl, '_blank');
    
    // Clear cart and close modal
    clearCart();
    onClose();
    
    // Analytics
    if (analytics) {
      logEvent(analytics, 'whatsapp_contact', {
        items: cart.items.length,
        total_value: cart.total
      });
    }
  };

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

      // Prepare lead data
      const leadData: InsertLead = {
        formData: data,
        selectedItems: cart.items,
        totalAmount: cart.total,
        discountAmount: cart.discount,
        submittedAt: new Date(),
        recaptchaToken,
        status: "new"
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, "leads"), leadData);
      
      // Analytics
      if (analytics) {
        logEvent(analytics, 'form_submit', {
          form_id: 'checkout_form',
          lead_id: docRef.id,
          total_value: cart.total
        });
      }

      toast({
        title: "Richiesta inviata",
        description: "Ti contatteremo al più presto per fornirti tutte le informazioni richieste.",
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

  if (cart.itemCount === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="checkout-description">
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
            {cart.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span>{item.title}</span>
                <span>€{item.price.toLocaleString('it-IT')}</span>
              </div>
            ))}
            {cart.itemDiscount > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Sconto prodotto</span>
                <span>-€{cart.itemDiscount.toLocaleString('it-IT')}</span>
              </div>
            )}
            {cart.globalDiscount > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Sconto globale</span>
                <span>-€{cart.globalDiscount.toLocaleString('it-IT')}</span>
              </div>
            )}
            <hr className="border-brand-secondary" />
            <div className="flex justify-between font-bold text-lg text-brand-accent">
              <span>TOTALE</span>
              <span>€{cart.total.toLocaleString('it-IT')}</span>
            </div>
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
            
            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !form.watch('gdpr_consent')}
                className="w-full bg-brand-accent text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Invio in corso..." : "INVIA RICHIESTA"}
              </Button>
            </div>
          </form>
        )}
        
        {/* WhatsApp Button */}
        {settings && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Button
              onClick={handleWhatsAppShare}
              className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span>CONTATTACI SU WHATSAPP</span>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}