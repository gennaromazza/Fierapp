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
import type { LeadData } from './types';

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

  const handleDownloadPDF = () => {
    if (!validateForm()) return;
    
    // TODO: Implement PDF generation
    console.log('Generating PDF with:', { cart: cart.cart, lead: formData });
  };

  const handleSendRequest = () => {
    if (!validateForm()) return;
    
    // TODO: Implement lead submission and WhatsApp opening
    console.log('Submitting lead and opening WhatsApp:', formData);
    onComplete(formData);
  };

  const pricing = cart.getPricingWithRules();

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
              €{item.price}
            </span>
          </div>
        ))}
        
        <div className="border-t pt-2 mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Subtotale:</span>
            <span>€{pricing.subtotal}</span>
          </div>
          {pricing.discount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Sconto globale:</span>
              <span>-€{pricing.discount}</span>
            </div>
          )}
          {pricing.giftSavings > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Risparmi omaggi:</span>
              <span>-€{pricing.giftSavings}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-1">
            <span>TOTALE:</span>
            <span>€{pricing.total}</span>
          </div>
          {pricing.totalSavings > 0 && (
            <div className="text-center text-green-600 font-semibold">
              Hai risparmiato €{pricing.totalSavings}!
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