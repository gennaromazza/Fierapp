import { useState, useEffect } from "react";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings, InsertLead } from "@shared/schema";
import { useCart } from "../hooks/useCart";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { X, MessageCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

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
              fieldSchema = fieldSchema.optional();
              defaults[fieldName] = "";
            }
            
            schemaFields[fieldName] = fieldSchema;
          });
          
          // Add GDPR consent
          schemaFields.gdpr_consent = z.boolean().refine(val => val === true, {
            message: "Devi accettare il consenso GDPR per continuare"
          });
          defaults.gdpr_consent = false;
          
          setFormSchema(z.object(schemaFields));
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
  }, [isOpen]);

  const onSubmit = async (data: any) => {
    if (!settings) {
      toast({
        title: "Errore",
        description: "Configurazione non trovata",
        variant: "destructive",
      });
      return;
    }

    if (!settings.whatsappNumber) {
      toast({
        title: "Servizio non disponibile",
        description: "Il numero WhatsApp non è configurato. Contatta l'amministratore.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Execute reCAPTCHA if configured
      let recaptchaToken = "";
      if (settings.reCAPTCHASiteKey && window.grecaptcha) {
        try {
          recaptchaToken = await window.grecaptcha.execute(settings.reCAPTCHASiteKey, {
            action: "submit_lead"
          });
        } catch (error) {
          console.error("reCAPTCHA error:", error);
        }
      }

      // Prepare lead data
      const leadData: InsertLead = {
        customer: data,
        selectedItems: cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice,
        })),
        pricing: {
          subtotal: cart.subtotal,
          discount: cart.discount,
          total: cart.total,
        },
        gdprConsent: {
          accepted: data.gdpr_consent,
          text: settings.gdprText,
          timestamp: new Date(),
        },
        reCAPTCHAToken: recaptchaToken,
        status: "new",
      };

      // Save lead to Firestore
      await addDoc(collection(db, "leads"), {
        ...leadData,
        createdAt: new Date(),
      });

      // Log analytics event
      logEvent(analytics, "submit_lead", {
        value: cart.total,
        currency: "EUR",
        items: cart.items.map(item => ({
          item_id: item.id,
          item_name: item.title,
          category: item.category,
          price: item.price,
        })),
      });

      // Generate WhatsApp message
      const whatsappMessage = `
Ciao! Ho appena compilato il form sul vostro sito per:

SERVIZI/PRODOTTI SELEZIONATI:
${cart.items.map(item => `• ${item.title} - €${item.price.toLocaleString('it-IT')}`).join('\n')}

RIEPILOGO:
- Subtotale: €${cart.subtotal.toLocaleString('it-IT')}
${cart.discount > 0 ? `- Sconto: -€${cart.discount.toLocaleString('it-IT')}` : ''}
- TOTALE: €${cart.total.toLocaleString('it-IT')}

DATI CLIENTE:
${Object.entries(data)
  .filter(([key]) => key !== 'gdpr_consent')
  .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
  .join('\n')}

Grazie per la disponibilità!
      `.trim();

      // Open WhatsApp
      const whatsappUrl = generateWhatsAppLink(settings.whatsappNumber, whatsappMessage);
      window.open(whatsappUrl, '_blank');

      // Log WhatsApp open event
      logEvent(analytics, "open_whatsapp", {
        value: cart.total,
        currency: "EUR",
      });

      // Clear cart and close modal
      clearCart();
      onClose();

      toast({
        title: "Richiesta inviata!",
        description: "Ti abbiamo reindirizzato su WhatsApp per completare la richiesta.",
      });

    } catch (error) {
      console.error("Error submitting lead:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || cart.itemCount === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-brand-accent">RICHIEDI INFORMAZIONI</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
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
              {cart.discount > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Sconto totale</span>
                  <span>-€{cart.discount.toLocaleString('it-IT')}</span>
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
              <button
                type="submit"
                disabled={isSubmitting || !settings.whatsappNumber}
                className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-5 h-5" />
                <span>
                  {isSubmitting
                    ? "INVIO IN CORSO..."
                    : !settings.whatsappNumber
                    ? "WHATSAPP NON CONFIGURATO"
                    : "INVIA RICHIESTA VIA WHATSAPP"
                  }
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
