export function generateWhatsAppLink(phoneNumber: string, message: string): string {
  // Clean phone number (remove spaces, dashes, etc.)
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
  
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Generate WhatsApp link
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}

export function formatPhoneNumberForWhatsApp(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it starts with 0, replace with +39 (for Italian numbers)
  if (cleaned.startsWith('0')) {
    cleaned = '+39' + cleaned.substring(1);
  }
  
  // If it doesn't start with +, assume it needs +39
  if (!cleaned.startsWith('+')) {
    cleaned = '+39' + cleaned;
  }
  
  return cleaned;
}

export function validatePhoneNumber(phoneNumber: string): boolean {
  // Basic validation for international phone numbers
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  return phoneRegex.test(cleaned);
}
