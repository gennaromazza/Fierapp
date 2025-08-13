import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { generateMarketingMessages, formatPricingSummary } from '../../lib/unifiedPricing';
import { collection, addDoc, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import type { LeadData } from './types';
import type { Settings } from '../../../../shared/schema';
import { generateClientQuotePDF } from '@/lib/pdf';

// Assume calculateUnifiedPricing and discounts are available in this scope
// For demonstration purposes, let's define dummy versions if they are not imported
// In a real scenario, these would be imported or defined elsewhere.

interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: 'all' | 'specific';
  productIds?: string[];
}

// Dummy function for calculateUnifiedPricing - replace with actual implementation
const calculateUnifiedPricing = (items: any[], discounts: Discount[], giftItemIds: string[]) => {
  let originalSubtotal = 0;
  let totalDiscountSavings = 0;
  let giftSavings = 0;

  items.forEach(item => {
    originalSubtotal += item.originalPrice;
    if (giftItemIds.includes(item.id)) {
      giftSavings += item.originalPrice;
    }
  });

  let remainingItems = items.filter(item => !giftItemIds.includes(item.id));
  let currentSubtotal = originalSubtotal - giftSavings;

  discounts.forEach(discount => {
    if (discount.appliesTo === 'all') {
      if (discount.type === 'percentage') {
        const discountAmount = currentSubtotal * (discount.value / 100);
        totalDiscountSavings += discountAmount;
        currentSubtotal -= discountAmount;
      } else if (discount.type === 'fixed') {
        const discountAmount = discount.value;
        totalDiscountSavings += discountAmount;
        currentSubtotal -= discountAmount;
      }
    } else if (discount.appliesTo === 'specific') {
      remainingItems.forEach(item => {
        if (discount.productIds?.includes(item.id) && !giftItemIds.includes(item.id)) {
          if (discount.type === 'percentage') {
            const discountAmount = item.originalPrice * (discount.value / 100);
            totalDiscountSavings += discountAmount;
            currentSubtotal -= discountAmount; // This approach might need refinement to correctly apply discounts to specific items within the subtotal
          } else if (discount.type === 'fixed') {
            const discountAmount = discount.value;
            totalDiscountSavings += discountAmount;
            currentSubtotal -= discountAmount; // Similar refinement needed
          }
        }
      });
    }
  });

  // Ensure final total does not go below zero
  currentSubtotal = Math.max(0, currentSubtotal);

  return {
    originalSubtotal,
    totalDiscountSavings,
    giftSavings,
    finalTotal: currentSubtotal,
    totalSavings: totalDiscountSavings + giftSavings,
    detailed: {} // Placeholder for more detailed breakdown if needed
  };
};

// Dummy discounts - replace with actual fetched discounts
const discounts: Discount[] = [
  // { type: 'percentage', value: 10, appliesTo: 'all' },
  // { type: 'fixed', value: 50, appliesTo: 'specific', productIds: ['prod_123'] }
];


interface LeadFormProps {
  initialData: LeadData;
  onComplete: (leadData: LeadData) => void;
  className?: string;
}

export function LeadForm({ initialData, onComplete, className }: LeadFormProps) {
  const cart = useCartWithRules();
  const [formData, setFormData] = useState<LeadData>({
    name: '',
    surname: '',
    email: '',
    phone: '',
    eventDate: '',
    notes: '',
    gdprAccepted: false,
    ...initialData
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'name':
      case 'surname':
        return !value || value.trim().length < 2 ? 'Questo campo è obbligatorio' : '';
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !value || !emailRegex.test(value) ? 'Inserisci un email valida' : '';
      case 'phone':
        const phoneRegex = /^\+?\d{7,15}$/;
        return !value || !phoneRegex.test(value.replace(/\s/g, '')) ? 'Inserisci un numero valido' : '';
      case 'eventDate':
        return !value ? 'La data delle nozze è obbligatoria' : '';
      case 'gdprAccepted':
        return !value ? 'Devi accettare la privacy policy' : '';
      default:
        return '';
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    Object.keys(formData).forEach(field => {
      if (field !== 'notes') { // notes is optional
        const error = validateField(field, formData[field as keyof LeadData]);
        if (error) newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.name && formData.surname && formData.email && 
           formData.phone && formData.eventDate && formData.gdprAccepted;
  };

  const handleDownloadPDF = async () => {
    if (!validateForm()) return;

    try {
      // Get pricing for PDF
      const pdfPricing = cart.getPricingWithRules();
      
      // Create PDF data structure like the old system
      const pdfData = {
        customer: {
          nome: formData.name,
          cognome: formData.surname,
          email: formData.email,
          telefono: formData.phone,
          data_evento: formData.eventDate,
          note: formData.notes
        },
        selectedItems: cart.cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: pdfPricing
      };

      const customerName = formData.name || 'cliente';
      const filename = `preventivo-matrimonio-${customerName}-${formData.surname || ''}-${new Date().toISOString().slice(0, 10)}.pdf`;

      // Use the professional PDF generation from the old system
      await generateClientQuotePDF(pdfData, filename);

    } catch (error) {
      console.error('Errore nella generazione del PDF:', error);
      alert('Errore nella generazione del PDF. Riprova.');
    }
  };

  const handleSendRequest = async () => {
    if (!validateForm()) return;

    try {
      // Get pricing first
      const leadPricing = cart.getPricingWithRules();
      
      // Save lead to Firebase using EXACT same format as CheckoutModal
      const leadData = {
        customer: {
          nome: formData.name,
          cognome: formData.surname,
          email: formData.email,
          telefono: formData.phone,
          data_evento: formData.eventDate ? formData.eventDate : null,
          note: formData.notes || '',
          gdpr_consent: formData.gdprAccepted
        },
        selectedItems: cart.cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price, // This should be the final price after discounts
          originalPrice: item.originalPrice
        })),
        pricing: leadPricing, // This should use the unified pricing
        gdprConsent: {
          accepted: formData.gdprAccepted,
          text: "Accetto il trattamento dei dati personali",
          timestamp: new Date()
        },
        status: "new",
        source: 'conversational-guide'
      };

      const leadDoc = await addDoc(collection(db, "leads"), leadData);

      console.log('Lead salvato con ID:', leadDoc.id);

      // Create professional WhatsApp message like the old system
      const itemsList = cart.cart.items.map(item => 
        `• ${item.title} - €${item.price.toLocaleString('it-IT')}` // This should reflect the final price
      ).join('\n');

      // This pricing summary should reflect the unified pricing

      const formDataText = [
        `Nome: ${formData.name}`,
        `Cognome: ${formData.surname}`,
        `Email: ${formData.email}`,
        `Telefono: ${formData.phone}`,
        `Data evento: ${formData.eventDate ? format(new Date(formData.eventDate), 'dd/MM/yyyy') : 'Non specificata'}`,
        formData.notes ? `Note: ${formData.notes}` : ''
      ].filter(Boolean).join('\n');

      // Use the unified system for the message
      const unifiedPricingDetails = leadPricing.detailed || leadPricing;
      const marketingMessages = generateMarketingMessages(unifiedPricingDetails);
      const pricingSummary = formatPricingSummary(unifiedPricingDetails);

      const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${itemsList}\n\n💰 RIEPILOGO:\n${pricingSummary}\n\n${marketingMessages.mainSavings ? `🔥 ${marketingMessages.mainSavings}\n` : ''}${marketingMessages.giftMessage ? `🎁 ${marketingMessages.giftMessage}\n` : ''}\n📝 Lead ID: ${leadDoc.id}`;

      // Open WhatsApp with professional formatting
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');

      // Call onComplete callback
      onComplete(formData);

    } catch (error) {
      console.error('Errore nel salvataggio del lead:', error);
      alert('Errore nel salvataggio. Riprova.');
    }
  };

  // Usa il sistema pricing esistente dalla cart 
  const cartPricing = cart.getPricingWithRules();
  
  // Sicurezza contro valori NaN
  const safePricing = {
    originalSubtotal: isNaN(cartPricing.originalSubtotal) ? cartPricing.subtotal : cartPricing.originalSubtotal,
    subtotal: isNaN(cartPricing.subtotal) ? 0 : cartPricing.subtotal,
    discount: isNaN(cartPricing.discount) ? 0 : cartPricing.discount,
    giftSavings: isNaN(cartPricing.giftSavings) ? 0 : cartPricing.giftSavings,
    total: isNaN(cartPricing.total) ? 0 : cartPricing.total,
    totalSavings: isNaN(cartPricing.totalSavings) ? 0 : cartPricing.totalSavings,
    detailed: cartPricing.detailed || cartPricing
  };

  return (
    <div className={cn("bg-white rounded-lg p-6 shadow-lg max-w-md mx-auto", className)}>
      {/* Cart Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-3">Riepilogo Selezione</h3>

        {cart.getItemsWithRuleInfo().map((item) => (
          <div key={item.id} className="flex justify-between text-sm mb-1">
            <span className={cn(item.isGift && "text-green-600")}>
              {item.title} {item.isGift && "(OMAGGIO)"}
            </span>
            <span className={cn(item.isGift && "line-through text-gray-500")}>
              €{item.price} {/* Display the final price for the item */}
            </span>
          </div>
        ))}

        <div className="border-t pt-2 mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Subtotale:</span>
            <span>€{safePricing.originalSubtotal.toFixed(0)}</span>
          </div>
          {safePricing.discount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Sconti:</span>
              <span>-€{safePricing.discount.toFixed(0)}</span>
            </div>
          )}
          {safePricing.giftSavings > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Servizi gratuiti:</span>
              <span>-€{safePricing.giftSavings.toFixed(0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-1">
            <span>TOTALE:</span>
            <span>€{safePricing.total.toFixed(0)}</span>
          </div>
          {safePricing.totalSavings > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 mt-3">
              <div className="text-center text-green-800 font-bold text-lg mb-2">
                🎉 RISPARMIO TOTALE: €{safePricing.totalSavings.toFixed(0)}!
              </div>
              {(() => {
                const marketingMessages = generateMarketingMessages(safePricing.detailed);
                return (
                  <div className="space-y-1 text-center">
                    {marketingMessages.mainSavings && (
                      <div className="text-sm text-green-700 font-medium">
                        {marketingMessages.mainSavings.replace(/🔥|💰|✨|💡/, '')}
                      </div>
                    )}
                    {marketingMessages.giftMessage && (
                      <div className="text-sm text-green-600">
                        {marketingMessages.giftMessage}
                      </div>
                    )}
                    {marketingMessages.urgencyText && (
                      <div className="text-sm text-orange-600 font-medium mt-2">
                        {marketingMessages.urgencyText}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Lead Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              placeholder="Nome *"
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <Input
              placeholder="Cognome *"
              value={formData.surname || ''}
              onChange={(e) => handleInputChange('surname', e.target.value)}
              className={errors.surname ? 'border-red-500' : ''}
            />
            {errors.surname && <p className="text-red-500 text-xs mt-1">{errors.surname}</p>}
          </div>
        </div>

        <div>
          <Input
            type="email"
            placeholder="Email *"
            value={formData.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <Input
            type="tel"
            placeholder="Telefono *"
            value={formData.phone || ''}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className={errors.phone ? 'border-red-500' : ''}
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        <div>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.eventDate && "text-muted-foreground",
                  errors.eventDate && "border-red-500"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.eventDate 
                  ? format(new Date(formData.eventDate), "dd/MM/yyyy")
                  : "Data nozze *"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.eventDate ? new Date(formData.eventDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    handleInputChange('eventDate', date.toISOString());
                    setDateOpen(false);
                  }
                }}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.eventDate && <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>}
        </div>

        <div>
          <Textarea
            placeholder="Note aggiuntive (opzionale)"
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="gdpr"
            checked={formData.gdprAccepted || false}
            onCheckedChange={(checked) => handleInputChange('gdprAccepted', checked)}
            className={errors.gdprAccepted ? 'border-red-500' : ''}
          />
          <label htmlFor="gdpr" className="text-xs text-gray-600 leading-tight">
            Accetto il trattamento dei dati personali secondo la Privacy Policy e autorizzo l'invio di comunicazioni commerciali. *
          </label>
        </div>
        {errors.gdprAccepted && <p className="text-red-500 text-xs">{errors.gdprAccepted}</p>}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleDownloadPDF}
            disabled={!isFormValid()}
            className="w-full"
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Scarica Preventivo PDF
          </Button>

          <Button
            onClick={handleSendRequest}
            disabled={!isFormValid()}
            className="w-full"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Invia Richiesta
          </Button>

          <p className="text-xs text-gray-500 text-center">
            La richiesta verrà salvata e si aprirà automaticamente WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}