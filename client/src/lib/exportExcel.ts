import * as XLSX from 'xlsx';
import { Lead, Item } from '@shared/schema';

export function exportLeadsToExcel(leads: Lead[], filename = 'leads-export.xlsx') {
  // Prepare data for Excel
  const data = leads.map(lead => ({
    'ID': lead.id,
    'Data Creazione': lead.createdAt.toLocaleDateString('it-IT'),
    'Nome': lead.customer.nome || '',
    'Cognome': lead.customer.cognome || '',
    'Email': lead.customer.email || '',
    'Telefono': lead.customer.telefono || '',
    'Data Evento': lead.customer.data_evento || '',
    'Note': lead.customer.note_aggiuntive || '',
    'Servizi/Prodotti': lead.selectedItems.map(item => item.title).join(', '),
    'Subtotale': `€${lead.pricing.subtotal.toFixed(2)}`,
    'Sconto': `€${lead.pricing.discount.toFixed(2)}`,
    'Totale': `€${lead.pricing.total.toFixed(2)}`,
    'Stato': lead.status,
    'GDPR Accettato': lead.gdprConsent.accepted ? 'Sì' : 'No',
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');

  // Save file
  XLSX.writeFile(wb, filename);
}

export function exportItemsToExcel(items: Item[], filename = 'items-export.xlsx') {
  const data = items.map(item => ({
    'ID': item.id,
    'Titolo': item.title,
    'Sottotitolo': item.subtitle || '',
    'Descrizione': item.description || '',
    'Prezzo': item.price,
    'Prezzo Originale': item.originalPrice || item.price,
    'Categoria': item.category,
    'Attivo': item.active ? 'Sì' : 'No',
    'Ordine': item.sortOrder,
    'URL Immagine': item.imageUrl || '',
    'Data Creazione': item.createdAt.toLocaleDateString('it-IT'),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Items');
  XLSX.writeFile(wb, filename);
}

export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
