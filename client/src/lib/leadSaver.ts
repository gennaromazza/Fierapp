import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { InsertLead } from '@shared/schema';
import type { LeadData } from '../components/ConversationalGuide/types';

// Utility function to remove undefined values recursively
export function removeUndefinedDeep(obj: any, removeNull: boolean = false): any {
  // Gestione valori primitivi invalidi
  if (obj === undefined) return null;
  if (removeNull && obj === null) return null;
  if (Number.isNaN(obj)) return null;
  if (obj === Infinity || obj === -Infinity) return null;
  
  // Mantieni Date e serverTimestamp intatti
  if (obj instanceof Date) {
    return isNaN(obj.getTime()) ? null : obj;
  }
  
  // Se è una funzione serverTimestamp
  if (typeof obj === 'function' || (obj && typeof obj.toDate === 'function')) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined && (!removeNull || item !== null))
      .map(item => removeUndefinedDeep(item, removeNull));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj)
      .filter(([_, value]) => value !== undefined && (!removeNull || value !== null))
      .reduce((acc, [key, value]) => {
        acc[key] = removeUndefinedDeep(value, removeNull);
        return acc;
      }, {} as any);
  }
  
  return obj;
}

export interface SaveLeadOptions {
  customer: any;
  selectedItems?: Array<{
    id: string;
    title: string;
    price: number;
    originalPrice?: number;
  }>;
  pricing?: any;
  gdprConsent?: {
    accepted: boolean;
    text: string;
    timestamp: Date;
  };
  reCAPTCHAToken?: string;
  status?: string;
  notes?: string;
}

/**
 * Centralized function to save lead data to Firebase
 * Used by both CheckoutModal and LeadForm to avoid duplication
 */
export async function saveLead(options: SaveLeadOptions): Promise<string> {
  const {
    customer,
    selectedItems = [],
    pricing = null,
    gdprConsent,
    reCAPTCHAToken,
    status = "new",
    notes
  } = options;

  // Prepare lead data with correct schema structure
  const rawLeadData: InsertLead = {
    customer,
    selectedItems,
    pricing,
    gdprConsent: gdprConsent || {
      accepted: false,
      text: '', 
      timestamp: new Date()
    },
    status: status as "new" | "contacted" | "email_sent" | "quoted" | "closed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // Add optional fields
  if (reCAPTCHAToken) {
    rawLeadData.reCAPTCHAToken = reCAPTCHAToken;
  }

  // Note: notes field handled within customer data structure

  // Clean data to remove undefined values
  const cleanedLeadData = removeUndefinedDeep(rawLeadData);

  // Log cleaned data for debugging
  const jsonString = JSON.stringify(cleanedLeadData, null, 2);
  console.log('📤 Centralized lead save - JSON data:', jsonString);

  if (jsonString.includes('undefined')) {
    console.error('⚠️ ATTENZIONE: Trovati valori "undefined" nel lead data!');
    throw new Error('Invalid data: undefined values found');
  } else {
    console.log('✅ Nessun valore undefined nel lead data');
  }

  // Save to Firestore
  const docRef = await addDoc(collection(db, "leads"), cleanedLeadData);
  console.log("✅ Lead saved successfully with ID:", docRef.id);

  return docRef.id;
}

// Export leadDataToCustomer from fieldMappingHelper for consistency
export { leadDataToCustomer } from './fieldMappingHelper';