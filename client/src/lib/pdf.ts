import jsPDF from "jspdf";
import { db, storage } from "../firebase";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import type { Lead, Settings } from "@shared/schema";

/* ---------- UTIL COMUNI ---------- */
type PdfBrand = {
  studioName: string;
  primary: string;
  accent: string;
  logoDataUrl?: string;
  contacts?: {
    address?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
  };
};

const EUR = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const fmt = (n: number) => EUR.format(n ?? 0);

const mm = {
  pageW: 210,
  pageH: 297,
  left: 20,
  right: 20,
  headerH: 32, // leggermente più alto per i contatti
  footerH: 12,
};

function parseCssColor(input?: string, fallback = "#334155"): [number, number, number] {
  const s = (input || "").trim();
  const hex = s.startsWith("#") ? s.slice(1) : "";
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
    const v = Number.parseInt(full, 16);
    if (!Number.isNaN(v) && full.length === 6) {
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
  }
  const m = s.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return [Number(m[1])|0, Number(m[2])|0, Number(m[3])|0];
  return parseCssColor(fallback, "#334155");
}

function pickTextColorForBg([r, g, b]: [number, number, number]): [number, number, number] {
  const L = (0.2126*(r/255)**2.2 + 0.7152*(g/255)**2.2 + 0.0722*(b/255)**2.2);
  return L > 0.6 ? [33, 33, 33] : [255, 255, 255];
}

function parseFlexibleDate(d: any): Date {
  try {
    if (d instanceof Date) return d;
    if (d?.seconds) return new Date(d.seconds * 1000);
    if (d) return new Date(d);
  } catch {}
  return new Date();
}

async function toDataURLFromStoragePath(storagePath: string): Promise<string | undefined> {
  try {
    if (typeof window === "undefined") return undefined;
    const url = await getDownloadURL(ref(storage, storagePath));
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("No canvas context"));
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("Logo load failed"));
      img.src = url;
    });
  } catch {
    return undefined;
  }
}

async function getBrand(): Promise<PdfBrand> {
  const snap = await getDoc(doc(db, "settings", "app"));
  const data = (snap.exists() ? (snap.data() as Settings) : {}) as Settings;
  const studioName = data.studioName || "Studio Demo";
  const primary = data.brandPrimary || "#7fb0b2";
  const accent = data.brandAccent || data.brandSecondary || "#0f766e";
  const logoDataUrl = data.logoUrl ? await toDataURLFromStoragePath(data.logoUrl) : undefined;
  const contacts = {
    address: data.studioAddress || "",
    phone: data.phoneNumber || "",
    email: data.email || "",
    whatsapp: data.whatsappNumber || "",
  };
  return { studioName, primary, accent, logoDataUrl, contacts };
}

/** Genera e incrementa numero preventivo progressivo */
async function getNextQuoteNumber(): Promise<number> {
  return await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, "counters", "preventivi");
    const counterSnap = await transaction.get(counterRef);
    let newNumber = 1;
    if (counterSnap.exists()) {
      newNumber = (counterSnap.data().lastNumber || 0) + 1;
    }
    transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });
    return newNumber;
  });
}

/* ---------- DRAW HELPERS ---------- */
function drawHeader(doc: jsPDF, title: string, brand: PdfBrand) {
  const bg = parseCssColor(brand.primary);
  const tc = pickTextColorForBg(bg);

  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.rect(0, 0, mm.pageW, mm.headerH, "F");

  if (brand.logoDataUrl) {
    try { doc.addImage(brand.logoDataUrl, "PNG", mm.left, 5, 18, 18, undefined, "FAST"); } catch {}
  }

  doc.setTextColor(tc[0], tc[1], tc[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(brand.studioName, brand.logoDataUrl ? mm.left + 24 : mm.left, 12);
  doc.setFontSize(20);
  doc.text(title, brand.logoDataUrl ? mm.left + 24 : mm.left, 20);

  // Contatti - Visualizzazione migliorata
  if (brand.contacts) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let cx = mm.left;
    const contactInfo = [];
    
    if (brand.contacts.address) contactInfo.push(`📍 ${brand.contacts.address}`);
    if (brand.contacts.phone) contactInfo.push(`📞 ${brand.contacts.phone}`);
    if (brand.contacts.email) contactInfo.push(`✉️ ${brand.contacts.email}`);
    if (brand.contacts.whatsapp) contactInfo.push(`💬 ${brand.contacts.whatsapp}`);
    
    contactInfo.forEach((info, i) => {
      if (cx + doc.getTextWidth(info) > mm.pageW - mm.right) {
        cx = mm.left;
      }
      doc.text(info, cx, 28);
      cx += doc.getTextWidth(info) + 12;
    });
  }
  doc.setTextColor(33);
}

function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(230);
    doc.line(mm.left, mm.pageH - mm.footerH, mm.pageW - mm.right, mm.pageH - mm.footerH);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Pagina ${i} di ${pages}`, mm.pageW - mm.right, mm.pageH - 6, { align: "right" });
    doc.setTextColor(33);
  }
}

const contentTop = () => mm.headerH + 12;

function sectionTitle(doc: jsPDF, text: string, y: number, colorHex: string) {
  const [r, g, b] = parseCssColor(colorHex);
  const w = mm.pageW - mm.left - mm.right;
  doc.setFillColor(r, g, b);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.roundedRect(mm.left, y - 6, w, 10, 2, 2, "F");
  doc.text(text, mm.left + 4, y + 2);
  doc.setTextColor(33);
  return y + 12;
}

function keyValue(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(label, x, y);
  doc.setFontSize(11);
  doc.setTextColor(33);
  doc.text(value || "-", x, y + 6);
  return y + 12;
}

function ensureNextLine(doc: jsPDF, y: number) {
  if (y > mm.pageH - mm.footerH - 20) {
    doc.addPage();
    return contentTop();
  }
  return y;
}

/* ---------- API ---------- */

/** Genera PDF preventivo per cliente (senza numero progressivo) */
export async function generateClientQuotePDF(leadData: any, filename?: string): Promise<void> {
  const brand = await getBrand();
  const doc = new jsPDF();
  drawHeader(doc, "Preventivo", brand);

  let y = contentTop();

  // Dati Cliente
  y = sectionTitle(doc, "DATI CLIENTE", y, brand.accent);
  y = ensureNextLine(doc, y);

  const customerData = leadData.customer || {};
  const cols = 2;
  let col = 0;
  const colW = (mm.pageW - mm.left - mm.right) / cols;

  Object.entries(customerData)
    .filter(([key, value]) => key !== 'gdpr_consent' && value)
    .forEach(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const x = mm.left + (col * colW);
      y = keyValue(doc, x, y, label + ":", String(value));
      col = (col + 1) % cols;
      if (col === 0) y += 6;
    });

  y += 12;

  // Servizi/Prodotti
  y = sectionTitle(doc, "SERVIZI/PRODOTTI SELEZIONATI", y, brand.accent);
  y = ensureNextLine(doc, y);

  leadData.selectedItems?.forEach((item: any) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(item.title, mm.left, y);
    doc.text(`€${item.price.toLocaleString('it-IT')}`, mm.pageW - mm.right, y, { align: "right" });
    
    if (item.originalPrice && item.originalPrice !== item.price) {
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Prezzo originale: €${item.originalPrice.toLocaleString('it-IT')}`, mm.left + 4, y);
      doc.setTextColor(33);
    }
    y += 12;
    y = ensureNextLine(doc, y);
  });

  // Totale
  y += 6;
  doc.setDrawColor(200);
  doc.line(mm.left, y, mm.pageW - mm.right, y);
  y += 8;

  const pricing = leadData.pricing || {};
  if (pricing.discount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Subtotale:", mm.left, y);
    doc.text(`€${pricing.subtotal?.toLocaleString('it-IT') || '0'}`, mm.pageW - mm.right, y, { align: "right" });
    y += 8;
    
    doc.setTextColor(0, 150, 0);
    doc.text("Sconto:", mm.left, y);
    doc.text(`-€${pricing.discount.toLocaleString('it-IT')}`, mm.pageW - mm.right, y, { align: "right" });
    doc.setTextColor(33);
    y += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TOTALE:", mm.left, y);
  doc.text(`€${pricing.total?.toLocaleString('it-IT') || '0'}`, mm.pageW - mm.right, y, { align: "right" });

  drawFooter(doc);
  doc.save(filename || `preventivo-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Genera PDF preventivo per admin (con numero progressivo) */
export async function generateQuotePDF(lead: Lead): Promise<void> {
  const brand = await getBrand();
  const quoteNumber = await getNextQuoteNumber();
  const doc = new jsPDF();
  drawHeader(doc, `Preventivo #${quoteNumber}`, brand);

  let y = contentTop();
  y = sectionTitle(doc, "Dati Cliente", y, brand.accent);
  const colW = (mm.pageW - mm.left - mm.right) / 2;
  const leadDate = parseFlexibleDate(lead.createdAt);

  y = keyValue(doc, mm.left, y, "Data preventivo", leadDate.toLocaleDateString("it-IT"));
  y = keyValue(doc, mm.left, y, "Cliente", `${lead.customer?.nome || ""} ${lead.customer?.cognome || ""}`.trim());
  y = keyValue(doc, mm.left, y, "Email", lead.customer?.email || "-");
  y = keyValue(doc, mm.left, y, "Telefono", lead.customer?.telefono || "-");

  let yR = y - 36;
  yR = keyValue(doc, mm.left + colW, yR, "Data evento", String(lead.customer?.data_evento || "-"));
  y = Math.max(y, yR) + 4;

  // Prodotti/Servizi
  y = ensureNextLine(doc, y + 2);
  y = sectionTitle(doc, "Servizi / Prodotti Selezionati", y, brand.accent);
  const tableX = mm.left;
  const tableW = mm.pageW - mm.left - mm.right;
  const colTitleW = tableW * 0.72;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setDrawColor(220);
  doc.setFillColor(245, 245, 245);
  doc.rect(tableX, y, tableW, 8, "FD");
  doc.text("Voce", tableX + 2, y + 5);
  doc.text("Prezzo", tableX + colTitleW + 2, y + 5);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (!lead.selectedItems?.length) {
    doc.text("— Nessun elemento selezionato —", tableX + 2, y);
    y += 10;
  } else {
    lead.selectedItems.forEach((item, i) => {
      const title = `${i + 1}. ${item.title || "Voce"}`;
      const price = fmt(Number(item.price || 0));
      const lines = doc.splitTextToSize(title, colTitleW - 6);
      const rowH = Math.max(lines.length * 6, 6) + 6;
      if (y + rowH > mm.pageH - mm.footerH - 10) {
        doc.addPage();
        y = contentTop();
      }
      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(tableX, y, tableW, rowH, "F");
      }
      let ty = y + 5;
      lines.forEach((line: string) => { doc.text(line, tableX + 2, ty); ty += 6; });
      doc.text(price, tableX + colTitleW + 2, y + rowH / 2 + 2);
      doc.setDrawColor(235);
      doc.line(tableX, y + rowH, tableX + tableW, y + rowH);
      y += rowH;
    });
  }

  // Totali
  y = ensureNextLine(doc, y + 6);
  const [ar, ag, ab] = parseCssColor(brand.accent);
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(tableX, y, tableW, 24, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  let yTot = y + 8;
  doc.text(`Subtotale: ${fmt(lead.pricing?.subtotal || 0)}`, tableX + 4, yTot);
  yTot += 7;
  if ((lead.pricing?.discount || 0) > 0) {
    doc.text(`Sconto: -${fmt(lead.pricing!.discount)}`, tableX + 4, yTot);
    yTot += 7;
  }
  doc.setFontSize(14);
  doc.text(`TOTALE: ${fmt(lead.pricing?.total || 0)}`, tableX + 4, yTot);
  doc.setTextColor(33);
  y += 30;

  // Note
  if (lead.customer?.note_aggiuntive) {
    y = ensureNextLine(doc, y);
    y = sectionTitle(doc, "Note", y, brand.accent);
    const note = doc.splitTextToSize(String(lead.customer.note_aggiuntive), tableW);
    note.forEach((line: string) => { doc.text(line, mm.left, y); y += 6; });
  }

  drawFooter(doc);
  doc.save(`preventivo-${quoteNumber}.pdf`);
}

export async function generateLeadSummaryPDF(leads: Lead[]): Promise<void> {
  const brand = await getBrand();
  const doc = new jsPDF();
  drawHeader(doc, "Riepilogo Lead", brand);
  let y = contentTop();

  const totalValue = leads.reduce((s, l) => s + (l.pricing?.total || 0), 0);
  const totalDiscount = leads.reduce((s, l) => s + (l.pricing?.discount || 0), 0);

  y = sectionTitle(doc, "Statistiche", y, brand.accent);
  y = keyValue(doc, mm.left, y, "Periodo", new Date().toLocaleDateString("it-IT"));
  y = keyValue(doc, mm.left, y, "Totale Lead", String(leads.length));
  y = keyValue(doc, mm.left, y, "Valore Totale", fmt(totalValue));
  y = keyValue(doc, mm.left, y, "Sconti Totali", fmt(totalDiscount));

  y = ensureNextLine(doc, y + 2);
  y = sectionTitle(doc, "Elenco Lead", y, brand.accent);
  const tableX = mm.left;
  const tableW = mm.pageW - mm.left - mm.right;
  const colNameW = tableW * 0.54;
  const colDateW = tableW * 0.22;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setDrawColor(220);
  doc.setFillColor(245, 245, 245);
  doc.rect(tableX, y, tableW, 8, "FD");
  doc.text("Cliente", tableX + 2, y + 5);
  doc.text("Data preventivo", tableX + colNameW + 2, y + 5);
  doc.text("Totale", tableX + colNameW + colDateW + 2, y + 5);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  leads.forEach((lead, i) => {
    const name = `${lead.customer?.nome || ""} ${lead.customer?.cognome || ""}`.trim() || "—";
    const when = parseFlexibleDate(lead.createdAt).toLocaleDateString("it-IT");
    const total = fmt(lead.pricing?.total || 0);
    const nameLines = doc.splitTextToSize(`${i + 1}. ${name}`, colNameW - 4);
    const rowH = Math.max(nameLines.length * 6, 6);
    if (y + rowH > mm.pageH - mm.footerH - 10) {
      doc.addPage();
      y = contentTop();
    }
    nameLines.forEach((line: string, idx: number) => doc.text(line, tableX + 2, y + 5 + idx * 6));
    doc.text(when, tableX + colNameW + 2, y + 5);
    doc.text(total, tableX + colNameW + colDateW + 2, y + 5);
    y += rowH + 4;
    doc.setDrawColor(240);
    doc.line(tableX, y, tableX + tableW, y);
    y += 2;
  });

  drawFooter(doc);
  const today = new Date().toISOString().split("T")[0];
  doc.save(`riepilogo-lead-${today}.pdf`);
}
