import { serverTimestamp } from 'firebase/firestore';

/**
 * Rimuove ricorsivamente valori undefined, NaN, Infinity da un oggetto
 * per renderlo sicuro per Firebase Firestore
 */
export function removeUndefinedDeep(obj: any, removeNull: boolean = false): any {
  // Gestione valori primitivi invalidi
  if (obj === undefined) return null;
  if (removeNull && obj === null) return null;
  if (Number.isNaN(obj)) return null;
  if (obj === Infinity || obj === -Infinity) return null;
  
  // Gestione Date
  if (obj instanceof Date) {
    if (isNaN(obj.getTime())) return null;
    return obj;
  }
  
  // Gestione funzioni speciali di Firebase
  if (obj && typeof obj === 'object' && obj._methodName === 'serverTimestamp') {
    return obj;
  }
  
  // Gestione array
  if (Array.isArray(obj)) {
    const cleanedArray = obj
      .map(item => removeUndefinedDeep(item, removeNull))
      .filter(item => item !== undefined && (!removeNull || item !== null));
    return cleanedArray.length > 0 ? cleanedArray : [];
  }
  
  // Gestione oggetti
  if (obj && typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const cleanedValue = removeUndefinedDeep(value, removeNull);
        
        if (cleanedValue !== undefined && (!removeNull || cleanedValue !== null)) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  
  // Valori primitivi validi
  return obj;
}

/**
 * Prepara i dati per il salvataggio in Firestore
 */
export function prepareFirestoreData(data: any): any {
  const cleaned = removeUndefinedDeep(data);
  
  // Aggiungi timestamp se non presente
  if (cleaned && typeof cleaned === 'object' && !cleaned.timestamp) {
    cleaned.timestamp = serverTimestamp();
  }
  
  return cleaned;
}

/**
 * Valida che i dati siano pronti per Firestore
 */
export function validateFirestoreData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const checkValue = (value: any, path: string = ''): void => {
    if (value === undefined) {
      errors.push(`Undefined value at ${path || 'root'}`);
    } else if (Number.isNaN(value)) {
      errors.push(`NaN value at ${path || 'root'}`);
    } else if (value === Infinity || value === -Infinity) {
      errors.push(`Infinity value at ${path || 'root'}`);
    } else if (value instanceof Date && isNaN(value.getTime())) {
      errors.push(`Invalid Date at ${path || 'root'}`);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => checkValue(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object' && value._methodName !== 'serverTimestamp') {
      Object.keys(value).forEach(key => checkValue(value[key], path ? `${path}.${key}` : key));
    }
  };
  
  checkValue(data);
  
  return {
    isValid: errors.length === 0,
    errors
  };
}