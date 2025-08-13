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
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import type { LeadData } from './types';
import type { Settings } from '../../../../shared/schema';

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
      // Load settings for studio info
      const settingsDoc = await getDoc(doc(db, "settings", "app"));
      const settings = settingsDoc.exists() ? settingsDoc.data() as Settings : null;
      
      // Create PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPos = 20;
      
      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PREVENTIVO MATRIMONIO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      if (settings?.studioName) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.text(settings.studioName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
      }
      
      yPos += 10;
      
      // Customer info
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DATI CLIENTE:', 20, yPos);
      yPos += 8;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nome: ${formData.name} ${formData.surname}`, 20, yPos);
      yPos += 6;
      pdf.text(`Email: ${formData.email}`, 20, yPos);
      yPos += 6;
      pdf.text(`Telefono: ${formData.phone}`, 20, yPos);
      yPos += 6;
      pdf.text(`Data matrimonio: ${formData.eventDate ? format(new Date(formData.eventDate), 'dd/MM/yyyy') : 'Non specificata'}`, 20, yPos);
      yPos += 15;
      
      // Cart items
      pdf.setFont('helvetica', 'bold');
      pdf.text('SERVIZI E PRODOTTI:', 20, yPos);
      yPos += 8;
      
      const pricing = cart.getPricingWithRules();
      const itemsWithRules = cart.getItemsWithRuleInfo();
      
      pdf.setFont('helvetica', 'normal');
      itemsWithRules.forEach(item => {
        const itemText = `${item.title}${item.isGift ? ' (OMAGGIO)' : ''}`;
        const priceText = item.isGift ? 'GRATIS' : `€${item.price}`;
        pdf.text(itemText, 20, yPos);
        pdf.text(priceText, pageWidth - 40, yPos, { align: 'right' });
        yPos += 6;
      });
      
      yPos += 5;
      
      // Pricing summary
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Subtotale: €${pricing.subtotal}`, pageWidth - 80, yPos, { align: 'right' });
      yPos += 6;
      
      if (pricing.discount > 0) {
        pdf.setTextColor(220, 38, 38); // Red color
        pdf.text(`Sconto globale: -€${pricing.discount}`, pageWidth - 80, yPos, { align: 'right' });
        yPos += 6;
      }
      
      if (pricing.giftSavings > 0) {
        pdf.setTextColor(34, 197, 94); // Green color
        pdf.text(`Risparmi omaggi: -€${pricing.giftSavings}`, pageWidth - 80, yPos, { align: 'right' });
        yPos += 6;
      }
      
      pdf.setTextColor(0, 0, 0); // Black color
      pdf.setFontSize(14);
      pdf.text(`TOTALE: €${pricing.total}`, pageWidth - 80, yPos, { align: 'right' });
      
      if (pricing.totalSavings > 0) {
        yPos += 8;
        pdf.setTextColor(34, 197, 94); // Green color
        pdf.setFontSize(12);
        pdf.text(`Hai risparmiato €${pricing.totalSavings}!`, pageWidth / 2, yPos, { align: 'center' });
      }
      
      // Notes section
      if (formData.notes) {
        yPos += 15;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NOTE:', 20, yPos);
        yPos += 8;
        pdf.setFont('helvetica', 'normal');
        pdf.text(formData.notes, 20, yPos, { maxWidth: pageWidth - 40 });
      }
      
      // Footer
      yPos += 20;
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      pdf.text('Preventivo generato automaticamente', pageWidth / 2, yPos, { align: 'center' });
      
      // Save PDF
      pdf.save(`preventivo-matrimonio-${formData.name}-${formData.surname}.pdf`);
      
    } catch (error) {
      console.error('Errore nella generazione del PDF:', error);
      alert('Errore nella generazione del PDF. Riprova.');
    }
  };

  const handleSendRequest = async () => {
    if (!validateForm()) return;
    
    try {
      // Save lead to Firebase using EXACT same format as CheckoutModal
      const leadData = {
        customer: {
          nome: formData.name,
          cognome: formData.surname,
          email: formData.email,
          telefono: formData.phone,
          data_evento: formData.eventDate,
          note: formData.notes,
          gdpr_consent: formData.gdprAccepted
        },
        selectedItems: cart.cart.items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice
        })),
        pricing: cart.getPricingWithRules(),
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
      
      // Prepare WhatsApp message
      const itemsList = cart.getItemsWithRuleInfo()
        .map(item => `• ${item.title}${item.isGift ? ' (OMAGGIO)' : ` - €${item.price}`}`)
        .join('\n');
      
      const pricing = cart.getPricingWithRules();
      const whatsappMessage = encodeURIComponent(
        `🎊 RICHIESTA PREVENTIVO MATRIMONIO\n\n` +
        `👰🤵 Sposi: ${formData.name} ${formData.surname}\n` +
        `📅 Data matrimonio: ${formData.eventDate ? format(new Date(formData.eventDate), 'dd/MM/yyyy') : 'Non specificata'}\n` +
        `📞 Telefono: ${formData.phone}\n` +
        `📧 Email: ${formData.email}\n\n` +
        `🛍️ SERVIZI SELEZIONATI:\n${itemsList}\n\n` +
        `💰 RIEPILOGO PREZZI:\n` +
        `Subtotale: €${pricing.subtotal}\n` +
        (pricing.discount > 0 ? `Sconto globale: -€${pricing.discount}\n` : '') +
        (pricing.giftSavings > 0 ? `Risparmi omaggi: -€${pricing.giftSavings}\n` : '') +
        `TOTALE: €${pricing.total}\n` +
        (pricing.totalSavings > 0 ? `\n✨ Hai risparmiato €${pricing.totalSavings}!\n` : '') +
        (formData.notes ? `\n📝 Note: ${formData.notes}` : '')
      );
      
      // Open WhatsApp
      window.open(`https://wa.me/?text=${whatsappMessage}`, '_blank');
      
      // Call onComplete callback
      onComplete(formData);
      
    } catch (error) {
      console.error('Errore nel salvataggio del lead:', error);
      alert('Errore nel salvataggio. Riprova.');
    }
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