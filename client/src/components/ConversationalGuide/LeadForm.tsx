import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Download, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCartWithRules } from '@/hooks/useCartWithRules';
import { generateMarketingMessages, formatPricingSummary } from '../../lib/unifiedPricing';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import type { LeadData } from './types';
import { generateClientQuotePDF } from '@/lib/pdf';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { useQuery } from '@tanstack/react-query';


interface LeadFormProps {
  initialData: LeadData;
  onComplete: (leadData: LeadData) => void;
  className?: string;
}

export function LeadForm({ initialData, onComplete, className }: LeadFormProps) {
  const cart = useCartWithRules();
  // Individual form states initialized with initialData
  const [name, setName] = useState(initialData.name || '');
  const [surname, setSurname] = useState(initialData.surname || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [gdprAccepted, setGdprAccepted] = useState(initialData.gdprAccepted || false);
  const [eventDate, setEventDate] = useState<Date | undefined>(
    initialData.eventDate ? new Date(initialData.eventDate) : undefined
  );

  // 🆕 Sync state with initialData when it changes - Deep comparison
  useEffect(() => {
    console.log('📝 LeadForm - Syncing with initialData:', initialData);
    
    // Force update if initialData has values but current state is empty
    if (initialData.name && initialData.name.trim() !== '') {
      console.log('🔄 Force updating name:', initialData.name);
      setName(initialData.name);
    }
    if (initialData.surname && initialData.surname.trim() !== '') {
      console.log('🔄 Force updating surname:', initialData.surname);
      setSurname(initialData.surname);
    }
    if (initialData.email && initialData.email.trim() !== '') {
      console.log('🔄 Force updating email:', initialData.email);
      setEmail(initialData.email);
    }
    if (initialData.phone && initialData.phone.trim() !== '') {
      console.log('🔄 Force updating phone:', initialData.phone);
      setPhone(initialData.phone);
    }
    if (initialData.eventDate && initialData.eventDate.trim() !== '') {
      console.log('🔄 Force updating eventDate:', initialData.eventDate);
      setEventDate(new Date(initialData.eventDate));
    }
    if (initialData.notes && initialData.notes !== notes) {
      setNotes(initialData.notes);
    }
    if (typeof initialData.gdprAccepted === 'boolean' && initialData.gdprAccepted !== gdprAccepted) {
      setGdprAccepted(initialData.gdprAccepted);
    }
  }, [initialData]); // Solo initialData come dipendenza per evitare loop

  // Reconstruct formData object for backward compatibility
  const formData: LeadData = {
    name,
    surname,
    email,
    phone,
    notes,
    gdprAccepted,
    eventDate: eventDate ? eventDate.toISOString() : ''
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch settings for WhatsApp number using the same pattern as Header.tsx
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['settings', 'app'],
    queryFn: async () => {
      try {
        console.log('🔄 Fetching settings from Firebase settings/app...');
        const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
        
        if (!settingsDoc.exists()) {
          console.warn('⚠️ Settings document does not exist');
          return null;
        }

        const data = settingsDoc.data();
        console.log('✅ Raw settings data loaded:', JSON.stringify(data, null, 2));
        
        // Log specific fields we care about
        console.log('📞 WhatsApp number field value:', data?.whatsappNumber);
        console.log('📞 Phone number field value:', data?.phoneNumber);
        console.log('🏢 Studio name:', data?.studioName);
        console.log('📧 Email:', data?.email);
        
        // Type the data correctly as Settings
        return data as import('@shared/schema').Settings;
      } catch (error) {
        console.error('❌ Error loading settings:', error);
        throw error; // Let React Query handle the error
      }
    },
    staleTime: 30000, // Cache for 30 seconds
    retry: 3, // Retry failed requests
  });

  // Debug settings loading with enhanced information
  if (settingsLoading) {
    console.log('⏳ Settings loading...');
  }
  if (settingsError) {
    console.error('❌ Settings error:', settingsError);
  }
  if (settings) {
    console.log('✅ Settings loaded successfully:', {
      hasWhatsappNumber: !!settings.whatsappNumber,
      hasPhoneNumber: !!settings.phoneNumber,
      hasEmail: !!settings.email,
      hasStudioName: !!settings.studioName,
      whatsappLength: settings.whatsappNumber?.length || 0,
      phoneLength: settings.phoneNumber?.length || 0
    });
  }
  
  // Debug: Log when component mounts
  console.log('🔄 LeadForm mounted, fetching settings from settings/app...');

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
    // Update individual states
    switch (field) {
      case 'name':
        setName(value);
        break;
      case 'surname':
        setSurname(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'phone':
        setPhone(value);
        break;
      case 'notes':
        setNotes(value);
        break;
      case 'gdprAccepted':
        setGdprAccepted(value);
        break;
      case 'eventDate':
        setEventDate(value ? new Date(value) : undefined);
        break;
    }

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
    return name && surname && email && phone && eventDate && gdprAccepted;
  };

  const handleDownloadPDF = async () => {
    if (!validateForm()) return;

    try {
      // Get unified pricing for PDF
      const pdfPricing = cart.getPricingWithRules();
      
      // Create PDF data structure with unified pricing
      const pdfData = {
        customer: {
          nome: formData.name,
          cognome: formData.surname,
          email: formData.email,
          telefono: formData.phone,
          data_evento: formData.eventDate,
          note: formData.notes
        },
        selectedItems: cart.getItemsWithRuleInfo().map(item => ({
          id: item.id,
          title: item.title,
          price: item.isGift ? 0 : item.price,
          originalPrice: item.originalPrice || item.price,
          isGift: item.isGift
        })),
        pricing: {
          subtotal: pdfPricing.originalSubtotal,
          discount: pdfPricing.discount,
          total: pdfPricing.total,
          giftSavings: pdfPricing.giftSavings || 0,
          totalSavings: pdfPricing.totalSavings || 0
        }
      };

      const customerName = formData.name || 'cliente';
      const filename = `preventivo-matrimonio-${customerName}-${formData.surname || ''}-${new Date().toISOString().slice(0, 10)}.pdf`;

      await generateClientQuotePDF(pdfData, filename);

    } catch (error) {
      console.error('Errore nella generazione del PDF:', error);
      alert('Errore nella generazione del PDF. Riprova.');
    }
  };

  const handleSendRequest = async () => {
    if (!validateForm()) return;

    try {
      // Get unified pricing
      const leadPricing = cart.getPricingWithRules();
      
      // Save lead to Firebase usando il formato corretto
      const leadData = {
        customer: {
          nome: formData.name || '',
          cognome: formData.surname || '',
          email: formData.email || '',
          telefono: formData.phone || '',
          data_evento: formData.eventDate || '',
          note: formData.notes || '',
          gdpr_consent: !!formData.gdprAccepted
        },
        selectedItems: cart.getItemsWithRuleInfo().map(item => ({
          id: item.id || '',
          title: item.title || '',
          price: Number(item.isGift ? 0 : item.price) || 0,
          originalPrice: Number(item.originalPrice || item.price) || 0
        })),
        pricing: {
          subtotal: Number(leadPricing.originalSubtotal) || 0,
          discount: Number(leadPricing.discount) || 0,
          total: Number(leadPricing.total) || 0,
          giftSavings: Number(leadPricing.giftSavings) || 0,
          totalSavings: Number(leadPricing.totalSavings) || 0
        },
        gdprConsent: {
          accepted: !!formData.gdprAccepted,
          text: "Accetto il trattamento dei dati personali",
          timestamp: serverTimestamp()
        },
        status: "new",
        source: 'conversational-guide',
        createdAt: serverTimestamp()
      };

      const leadDoc = await addDoc(collection(db, "leads"), leadData);
      console.log('Lead salvato con ID:', leadDoc.id);

      // Crea messaggio WhatsApp professionale
      const itemsList = cart.getItemsWithRuleInfo().map(item => {
        const priceText = item.isGift ? 'GRATIS' : `€${item.price.toLocaleString('it-IT')}`;
        return `• ${item.title} - ${priceText}`;
      }).join('\n');

      const formDataText = [
        `Nome: ${formData.name}`,
        `Cognome: ${formData.surname}`,
        `Email: ${formData.email}`,
        `Telefono: ${formData.phone}`,
        `Data evento: ${formData.eventDate ? format(new Date(formData.eventDate), 'dd/MM/yyyy') : 'Non specificata'}`,
        formData.notes ? `Note: ${formData.notes}` : ''
      ].filter(Boolean).join('\n');

      // Usa il sistema unificato per il messaggio
      const marketingMessages = generateMarketingMessages(leadPricing.detailed);
      const pricingSummary = formatPricingSummary(leadPricing.detailed);

      const message = `🎬 RICHIESTA INFORMAZIONI\n\n📋 DATI CLIENTE:\n${formDataText}\n\n🛍️ SERVIZI/PRODOTTI SELEZIONATI:\n${itemsList}\n\n💰 RIEPILOGO:\n${pricingSummary}\n\n${marketingMessages.mainSavings ? `🔥 ${marketingMessages.mainSavings}\n` : ''}${marketingMessages.giftMessage ? `🎁 ${marketingMessages.giftMessage}\n` : ''}\n📝 Lead ID: ${leadDoc.id}`;

      // Enhanced WhatsApp number detection with better debugging
      console.log('🔍 Current settings state:', settings);
      console.log('📞 Settings loading:', settingsLoading);
      console.log('❌ Settings error:', settingsError);
      
      // Check if settings are still loading
      if (settingsLoading) {
        alert('Caricamento impostazioni in corso. Riprova tra un momento.');
        return;
      }

      // Check for errors in settings loading
      if (settingsError) {
        console.error('❌ Error loading settings:', settingsError);
        alert('Errore nel caricamento delle impostazioni. Verifica i permessi Firebase e riprova.');
        return;
      }
      
      // Enhanced number detection with multiple fallback options
      const whatsappNumber = settings?.whatsappNumber?.trim();
      const phoneNumber = settings?.phoneNumber?.trim();
      const studioEmail = settings?.email?.trim();
      
      console.log('📞 WhatsApp number (trimmed):', whatsappNumber);
      console.log('📞 Phone number (trimmed):', phoneNumber);
      console.log('📧 Studio email:', studioEmail);
      
      // Use WhatsApp number if available, otherwise fallback to phone number
      const contactNumber = whatsappNumber || phoneNumber;
      
      if (!contactNumber) {
        console.error('❌ No contact number found in settings');
        console.log('Settings complete object:', JSON.stringify(settings, null, 2));
        
        // If we have an email, suggest email as alternative
        if (studioEmail) {
          const useEmail = confirm(
            'Numero WhatsApp non configurato. Vuoi inviare una email invece?\n\n' +
            `Email: ${studioEmail}`
          );
          
          if (useEmail) {
            // Create email content
            const emailSubject = encodeURIComponent('Richiesta Informazioni - Matrimonio');
            const emailBody = encodeURIComponent(message);
            const emailUrl = `mailto:${studioEmail}?subject=${emailSubject}&body=${emailBody}`;
            window.open(emailUrl, '_blank');
            onComplete(formData);
            return;
          }
        }
        
        alert(
          'Configurazione mancante:\n\n' +
          '• Numero WhatsApp non configurato\n' +
          '• Numero telefono non configurato\n\n' +
          'Vai nel pannello admin → Impostazioni → Contatti per configurare almeno uno di questi campi.'
        );
        return;
      }
      
      console.log('✅ Using contact number:', contactNumber);
      
      console.log('Generating WhatsApp URL with number:', contactNumber);
      console.log('Message content preview:', message.substring(0, 100) + '...');
      
      const whatsappUrl = generateWhatsAppLink(contactNumber, message);
      console.log('Final WhatsApp URL:', whatsappUrl);
      
      // Additional debug info
      console.log('Studio name from settings:', settings?.studioName);
      console.log('Message length:', message.length);
      
      window.open(whatsappUrl, '_blank');
      onComplete(formData);

    } catch (error) {
      console.error('Errore nel salvataggio del lead:', error);
      alert('Errore nel salvataggio. Riprova.');
    }
  };

  // Test function for WhatsApp integration (for debugging)
  const testWhatsAppIntegration = () => {
    console.log('🧪 Testing WhatsApp integration...');
    console.log('Settings available:', !!settings);
    console.log('WhatsApp number:', settings?.whatsappNumber);
    console.log('Phone number:', settings?.phoneNumber);
    
    const testMessage = "Test message from lead form";
    const contactNumber = settings?.whatsappNumber?.trim() || settings?.phoneNumber?.trim();
    
    if (contactNumber) {
      const testUrl = generateWhatsAppLink(contactNumber, testMessage);
      console.log('Test WhatsApp URL:', testUrl);
      alert(`WhatsApp URL generated successfully:\n${testUrl}`);
    } else {
      alert('No contact number found in settings');
    }
  };

  // Add test button in development mode
  const isDevelopment = import.meta.env.DEV;

  // Usa il sistema di pricing unificato
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
              €{(item.isGift ? 0 : item.price).toLocaleString('it-IT')}
            </span>
          </div>
        ))}

        <div className="border-t pt-2 mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Subtotale:</span>
            <span>€{pricing.originalSubtotal.toLocaleString('it-IT')}</span>
          </div>
          {pricing.discount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Sconti:</span>
              <span>-€{pricing.discount.toLocaleString('it-IT')}</span>
            </div>
          )}
          {pricing.giftSavings > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Servizi gratuiti:</span>
              <span>-€{pricing.giftSavings.toLocaleString('it-IT')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-1">
            <span>TOTALE:</span>
            <span>€{pricing.total.toLocaleString('it-IT')}</span>
          </div>
          {pricing.totalSavings > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 mt-3">
              <div className="text-center text-green-800 font-bold text-lg mb-2">
                🎉 RISPARMIO TOTALE: €{pricing.totalSavings.toLocaleString('it-IT')}!
              </div>
              {(() => {
                const marketingMessages = generateMarketingMessages(pricing.detailed);
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
              value={name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <Input
              placeholder="Cognome *"
              value={surname}
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
            value={email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <Input
            type="tel"
            placeholder="Telefono *"
            value={phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className={errors.phone ? 'border-red-500' : ''}
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        <div>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              type="date"
              value={eventDate ? format(eventDate, "yyyy-MM-dd") : ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleInputChange('eventDate', new Date(e.target.value).toISOString());
                }
              }}
              min={format(new Date(), "yyyy-MM-dd")}
              className={cn(
                "pl-10",
                errors.eventDate && "border-red-500"
              )}
              placeholder="Data nozze *"
            />
          </div>
          {errors.eventDate && <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>}
        </div>

        <div>
          <Textarea
            placeholder="Note aggiuntive (opzionale)"
            value={notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="gdpr"
            checked={gdprAccepted}
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