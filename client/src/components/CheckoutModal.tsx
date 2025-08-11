import { useState, useEffect } from "react";
import { doc, getDoc, collection, addDoc, getDocs } from "firebase/firestore";
import { db, analytics } from "../firebase";
import { logEvent } from "firebase/analytics";
import { Settings, Item } from "@shared/schema";
import { useCart } from "../hooks/useCart";
import { generateWhatsAppLink } from "../lib/whatsapp";
import { MessageCircle, Plus, X, Loader2, Send, CheckCircle, ShoppingCart, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const { cart, clearCart, addItem } = useCart();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<Item[]>([]);

  // Dynamic form schema based on settings
  const [formSchema, setFormSchema] = useState<z.ZodSchema<any>>(z.object({}));
  const [formDefaults, setFormDefaults] = useState<Record<string, any>>({});

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: formDefaults,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "checkout"));
        if (settingsDoc.exists()) {
          const settingsData = settingsDoc.data() as Settings;
          setSettings(settingsData);

          // Create dynamic form schema
          const schemaFields: Record<string, z.ZodTypeAny> = {};
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

          const newSchema = z.object(schemaFields);
          setFormSchema(newSchema);
          setFormDefaults(defaults);
          form.reset(defaults);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    const loadAllItems = async () => {
      try {
        const itemsSnapshot = await getDocs(collection(db, "items"));
        const items = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Item[];
        setAllItems(items);

        // Calculate suggested items (items not in cart)
        const cartItemIds = cart.items.map(item => item.id);
        const suggested = items.filter(item => !cartItemIds.includes(item.id));
        setSuggestedItems(suggested.slice(0, 3)); // Show max 3 suggestions
      } catch (error) {
        console.error("Error loading items:", error);
      }
    };

    if (isOpen) {
      loadSettings();
      loadAllItems();
      setShowConfirmation(true);
    } else {
      setShowConfirmation(true); // Reset to confirmation view when modal closes and reopens
      setAllItems([]);
      setSuggestedItems([]);
    }
  }, [isOpen, cart.items, form]);

  const handleProceedToForm = () => {
    setShowConfirmation(false);
  };

  const handleAddSuggestedItem = (item: Item) => {
    addItem(item);
    // Remove from suggested items and update state
    setSuggestedItems(prev => prev.filter(i => i.id !== item.id));
    // Re-fetch and filter suggested items if needed, or just update the displayed list
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

      // Prepare lead data with correct schema structure
      const leadData: InsertLead = {
        customer: data,
        selectedItems: cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: {
          subtotal: cart.subtotal,
          discount: cart.discount,
          total: cart.total
        },
        gdprConsent: {
          accepted: data.gdpr_consent || false,
          text: settings.gdprText,
          timestamp: new Date()
        },
        reCAPTCHAToken: recaptchaToken,
        status: "new"
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, "leads"), leadData);
      console.log("Lead saved successfully with ID:", docRef.id);

      // Analytics
      if (analytics) {
        logEvent(analytics, 'form_submit', {
          form_id: 'checkout_form',
          lead_id: docRef.id,
          total_value: cart.total
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

        const totalText = cart.discount > 0 
          ? `Subtotale: €${(cart.total + cart.discount).toLocaleString('it-IT')}\nSconto: -€${cart.discount.toLocaleString('it-IT')}\nTotale: €${cart.total.toLocaleString('it-IT')}`
          : `Totale: €${cart.total.toLocaleString('it-IT')}`;

        const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${cartSummary}\n\n💰 RIEPILOGO:\n${totalText}\n\n📝 Lead ID: ${docRef.id}`;

        const whatsappUrl = generateWhatsAppLink(settings.whatsappNumber, message);
        window.open(whatsappUrl, '_blank');

        // Analytics for WhatsApp
        if (analytics) {
          logEvent(analytics, 'whatsapp_contact', {
            items: cart.items.length,
            total_value: cart.total,
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
      setIsSubmitted(true); // Set submitted state for success message
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

  if (cart.itemCount === 0 && !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-brand-primary" 
        aria-describedby="checkout-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-brand-accent">
            {showConfirmation ? "CONFERMA SELEZIONE" : "RICHIEDI INFORMAZIONI"}
          </DialogTitle>
          <DialogDescription id="checkout-description">
            {showConfirmation 
              ? "Verifica i prodotti/servizi selezionati prima di procedere"
              : "Compila il form per ricevere un preventivo personalizzato per i servizi selezionati."
            }
          </DialogDescription>
        </DialogHeader>

        {showConfirmation ? (
          <div className="space-y-6">
            {/* Selected Items Summary */}
            <div className="bg-brand-primary rounded-lg p-4">
              <h4 className="font-semibold text-brand-accent mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                I TUOI PRODOTTI/SERVIZI ({cart.itemCount})
              </h4>
              <div className="space-y-2 text-sm">
                {cart.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="font-medium">{item.title}</span>
                    <span className="font-bold">€{item.price.toLocaleString('it-IT')}</span>
                  </div>
                ))}
                {cart.discount > 0 && (
                  <div className="flex justify-between text-green-600 font-semibold pt-2 border-t">
                    <span>Sconto totale</span>
                    <span>-€{cart.discount.toLocaleString('it-IT')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-brand-accent pt-2 border-t">
                  <span>Totale</span>
                  <span>€{cart.total.toLocaleString('it-IT')}</span>
                </div>
              </div>
            </div>

            {/* Suggested Items */}
            {suggestedItems.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  TI SEI DIMENTICATO QUALCOSA?
                </h4>
                <p className="text-sm text-orange-700 mb-4">
                  Altri clienti hanno scelto anche questi prodotti/servizi:
                </p>
                <div className="space-y-2">
                  {suggestedItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded border">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.title}</div>
                        <div className="text-sm text-gray-600">{item.category}</div>
                        <div className="font-bold text-brand-accent">
                          €{item.price.toLocaleString('it-IT')}
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-sm text-gray-500 line-through ml-2">
                              €{item.originalPrice.toLocaleString('it-IT')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAddSuggestedItem(item)}
                        size="sm"
                        className="ml-3 bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Aggiungi
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Annulla
              </Button>
              <Button
                onClick={handleProceedToForm}
                className="btn-premium flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                Procedi con la richiesta
              </Button>
            </div>
          </div>
        ) : isSubmitted ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-brand-accent mb-2">Richiesta inviata con successo!</h3>
            <p className="text-gray-600 mb-6">
              Ti contatteremo al più presto per fornirti tutte le informazioni sui servizi selezionati.
            </p>
            <Button onClick={onClose} className="btn-premium">
              Chiudi
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Selected Items Summary - Compact */}
            <div className="bg-brand-primary rounded-lg p-3 mb-4">
              <h4 className="font-semibold text-brand-accent mb-2 text-sm">RIEPILOGO SELEZIONE</h4>
              <div className="space-y-1 text-xs">
                {cart.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.title}</span>
                    <span>€{item.price.toLocaleString('it-IT')}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-brand-accent pt-1 border-t">
                  <span>Totale</span>
                  <span>€{cart.total.toLocaleString('it-IT')}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowConfirmation(true)}
              variant="outline"
              size="sm"
              className="w-full mb-4"
            >
              ← Torna alla conferma
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings?.formFields.map((field, index) => {
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
                  {settings?.gdprText} *
                </span>
              </label>
              {form.formState.errors.gdpr_consent && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.gdpr_consent?.message as string}
                </p>
              )}
            </div>

            {/* reCAPTCHA Notice */}
            {settings?.reCAPTCHASiteKey && (
              <div className="text-xs text-gray-500 text-center">
                Questo sito è protetto da reCAPTCHA e si applicano la Privacy Policy e i Termini di Servizio di Google.
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
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