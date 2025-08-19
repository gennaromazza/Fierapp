import type { LeadData } from '../components/ConversationalGuide/types';

/**
 * Centralized field mapping helper to standardize form field handling
 * across CheckoutModal, LeadForm, and other components
 */

// Standard field name mappings
export const FIELD_MAPPINGS = {
  // Name variations
  name: ['nome', 'name', 'first_name', 'firstname'],
  surname: ['cognome', 'surname', 'last_name', 'lastname'],
  email: ['email', 'mail', 'e_mail', 'posta_elettronica'],
  phone: ['telefono', 'phone', 'tel', 'cellulare', 'mobile'],
  eventDate: ['data_evento', 'data', 'date', 'event_date', 'wedding_date', 'data_matrimonio'],
  notes: ['note', 'notes', 'note_aggiuntive', 'additional_notes', 'commenti', 'comments'],
  gdprConsent: ['gdpr_consent', 'privacy', 'privacy_consent', 'consenso_privacy']
};

// Reverse mapping for easier lookup
export const REVERSE_FIELD_MAPPINGS = Object.entries(FIELD_MAPPINGS).reduce((acc, [key, variations]) => {
  variations.forEach(variation => {
    acc[variation] = key as keyof LeadData;
  });
  return acc;
}, {} as Record<string, keyof LeadData>);

/**
 * Convert a form field label to a standardized snake_case field name
 */
export function labelToFieldName(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Map a field name to its canonical LeadData property
 */
export function mapToLeadDataField(fieldName: string): keyof LeadData | null {
  const normalized = fieldName.toLowerCase();
  
  // Direct match first
  if (REVERSE_FIELD_MAPPINGS[normalized]) {
    return REVERSE_FIELD_MAPPINGS[normalized];
  }
  
  // Fuzzy matching for common variations
  for (const [leadField, variations] of Object.entries(FIELD_MAPPINGS)) {
    if (variations.some(variation => normalized.includes(variation) || variation.includes(normalized))) {
      return leadField as keyof LeadData;
    }
  }
  
  return null;
}

/**
 * Pre-populate form data from LeadData using field mapping
 */
export function mapLeadDataToFormField(leadData: LeadData, fieldName: string): string {
  const mappedField = mapToLeadDataField(fieldName);
  
  if (!mappedField) return '';
  
  const value = leadData[mappedField];
  
  // Handle different value types
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value.toString();
  if (value && typeof value === 'object' && 'toISOString' in value) return (value as Date).toISOString().split('T')[0];
  
  return String(value);
}

/**
 * Convert LeadData to customer format for Firebase (Italian lowercase fields)
 */
export function leadDataToCustomer(leadData: LeadData): any {
  return {
    nome: leadData.name || '',
    cognome: leadData.surname || '',
    email: leadData.email || '',
    telefono: leadData.phone || '',
    data_evento: leadData.eventDate || '',
    note: leadData.notes || '',
    gdpr_consent: leadData.gdprAccepted || false
  };
}

/**
 * Convert form data back to LeadData format
 */
export function formDataToLeadData(formData: Record<string, any>): Partial<LeadData> {
  const leadData: Partial<LeadData> = {};
  
  Object.entries(formData).forEach(([fieldName, value]) => {
    const mappedField = mapToLeadDataField(fieldName);
    if (mappedField && value !== undefined && value !== '') {
      if (mappedField === 'gdprAccepted') {
        leadData[mappedField] = Boolean(value);
      } else if (mappedField === 'eventDate' && typeof value === 'string') {
        leadData[mappedField] = value;
      } else {
        (leadData as any)[mappedField] = String(value);
      }
    }
  });
  
  return leadData;
}

/**
 * Get field validation rules based on mapped field type
 */
export function getFieldValidation(fieldName: string): {
  required: boolean;
  pattern?: RegExp;
  message?: string;
} {
  const mappedField = mapToLeadDataField(fieldName);
  
  switch (mappedField) {
    case 'name':
    case 'surname':
      return {
        required: true,
        pattern: /^.{2,}$/,
        message: 'Questo campo è obbligatorio (min. 2 caratteri)'
      };
    case 'email':
      return {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Inserisci un email valida'
      };
    case 'phone':
      return {
        required: true,
        pattern: /^\+?\d{7,15}$/,
        message: 'Inserisci un numero valido'
      };
    case 'eventDate':
      return {
        required: true,
        message: 'La data delle nozze è obbligatoria'
      };
    case 'gdprAccepted':
      return {
        required: true,
        message: 'Devi accettare la privacy policy'
      };
    default:
      return {
        required: false
      };
  }
}

/**
 * Format field value for display (e.g., in WhatsApp messages)
 */
export function formatFieldForDisplay(fieldName: string, value: any, fieldLabel?: string): string {
  const mappedField = mapToLeadDataField(fieldName);
  const displayLabel = fieldLabel || fieldName;
  
  if (!value) return '';
  
  switch (mappedField) {
    case 'eventDate':
      // Format date for display
      try {
        const date = new Date(value);
        return `${displayLabel}: ${date.toLocaleDateString('it-IT')}`;
      } catch {
        return `${displayLabel}: ${value}`;
      }
    case 'gdprAccepted':
      return value ? `${displayLabel}: Accettata` : '';
    default:
      return `${displayLabel}: ${value}`;
  }
}