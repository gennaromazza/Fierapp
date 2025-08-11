import jsPDF from 'jspdf';
import { Lead } from '@shared/schema';

export function generateQuotePDF(lead: Lead, studioName = 'Studio Demo'): void {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text(`${studioName} - Preventivo`, 20, 30);
  
  // Lead info
  doc.setFontSize(12);
  doc.text(`Data: ${lead.createdAt.toLocaleDateString('it-IT')}`, 20, 50);
  doc.text(`Cliente: ${lead.customer.nome} ${lead.customer.cognome}`, 20, 60);
  doc.text(`Email: ${lead.customer.email}`, 20, 70);
  doc.text(`Telefono: ${lead.customer.telefono}`, 20, 80);
  
  if (lead.customer.data_evento) {
    doc.text(`Data Evento: ${lead.customer.data_evento}`, 20, 90);
  }
  
  // Services/Products
  doc.text('Servizi/Prodotti Selezionati:', 20, 110);
  
  let yPos = 125;
  lead.selectedItems.forEach((item, index) => {
    doc.text(`${index + 1}. ${item.title}`, 25, yPos);
    doc.text(`€${item.price.toFixed(2)}`, 160, yPos);
    yPos += 10;
  });
  
  // Totals
  yPos += 10;
  doc.text(`Subtotale: €${lead.pricing.subtotal.toFixed(2)}`, 20, yPos);
  yPos += 10;
  
  if (lead.pricing.discount > 0) {
    doc.text(`Sconto: -€${lead.pricing.discount.toFixed(2)}`, 20, yPos);
    yPos += 10;
  }
  
  doc.setFontSize(14);
  doc.text(`TOTALE: €${lead.pricing.total.toFixed(2)}`, 20, yPos);
  
  // Notes
  if (lead.customer.note_aggiuntive) {
    doc.setFontSize(12);
    doc.text('Note:', 20, yPos + 20);
    doc.text(lead.customer.note_aggiuntive, 20, yPos + 30);
  }
  
  // Footer
  doc.setFontSize(10);
  doc.text('Questo preventivo è valido per 30 giorni dalla data di emissione.', 20, 270);
  
  // Save the PDF
  doc.save(`preventivo-${lead.id}.pdf`);
}

export function generateLeadSummaryPDF(leads: Lead[], studioName = 'Studio Demo'): void {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text(`${studioName} - Riepilogo Lead`, 20, 30);
  
  // Summary stats
  const totalValue = leads.reduce((sum, lead) => sum + lead.pricing.total, 0);
  const totalDiscount = leads.reduce((sum, lead) => sum + lead.pricing.discount, 0);
  
  doc.setFontSize(12);
  doc.text(`Periodo: ${new Date().toLocaleDateString('it-IT')}`, 20, 50);
  doc.text(`Totale Lead: ${leads.length}`, 20, 60);
  doc.text(`Valore Totale: €${totalValue.toFixed(2)}`, 20, 70);
  doc.text(`Sconti Totali: €${totalDiscount.toFixed(2)}`, 20, 80);
  
  // Lead list
  doc.text('Elenco Lead:', 20, 100);
  
  let yPos = 115;
  leads.forEach((lead, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.text(`${index + 1}. ${lead.customer.nome} ${lead.customer.cognome}`, 25, yPos);
    doc.text(`€${lead.pricing.total.toFixed(2)}`, 160, yPos);
    yPos += 8;
  });
  
  doc.save(`riepilogo-lead-${new Date().toISOString().split('T')[0]}.pdf`);
}
