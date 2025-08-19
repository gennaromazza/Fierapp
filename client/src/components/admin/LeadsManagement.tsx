import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, updateDoc, doc, deleteDoc, where, Timestamp, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Lead, Customer, Settings } from "@shared/schema";
import { useCollection } from "../../hooks/useFirestore";
import { exportLeadsToExcel } from "../../lib/exportExcel";
import { generateQuotePDF } from "../../lib/pdf";
import { useToast } from "@/hooks/use-toast";
import { clearAllLeads } from "../../utils/clearLeads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Users, 
  Download, 
  FileText, 
  Eye, 
  Edit, 
  Trash2, 
  CalendarIcon, 
  Search,
  Filter,
  Mail,
  Phone,
  MessageCircle,
  Calendar as CalendarDays,
  Send
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

// No more helper functions needed - all leads now use the same unified format

export default function LeadsManagement() {
  const { data: allLeads, loading } = useCollection<Lead>("leads");
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Stato per editing lead
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Memoized filtered leads - expensive filtering operations
  const filteredLeads = useMemo(() => {
    if (!allLeads) return [];

    let filtered = allLeads;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead => {
        // Handle only unified structure (lead.customer)
        const customer = lead.customer || {};
        const searchFields = [
          customer.nome || '',
          customer.cognome || '',
          customer.email || '',
          customer.telefono || ''
        ];

        return searchFields.some(field => 
          typeof field === 'string' && field.toLowerCase().includes(searchTerm.toLowerCase())
        ) || Object.values(customer).some(value => 
          typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(lead => {
        try {
          const leadDate = lead.createdAt instanceof Date ? lead.createdAt : 
                          (lead.createdAt as any)?.seconds ? new Date((lead.createdAt as any).seconds * 1000) :
                          typeof lead.createdAt === 'string' ? new Date(lead.createdAt) : new Date();
          return format(leadDate, "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd");
        } catch (e) {
          return false;
        }
      });
    }

    return filtered;
  }, [allLeads, searchTerm, statusFilter, dateFilter]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const ITEMS_PER_PAGE = 20;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter]);

  const updateLeadStatus = async (leadId: string, newStatus: Lead["status"]) => {
    try {
      await updateDoc(doc(db, "leads", leadId), { status: newStatus });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato del lead è stato aggiornato con successo",
      });
    } catch (error) {
      console.error("Error updating lead status:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo lead?")) return;

    try {
      await deleteDoc(doc(db, "leads", leadId));
      toast({
        title: "Lead eliminato",
        description: "Il lead è stato eliminato con successo",
      });
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del lead",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    if (filteredLeads.length === 0) {
      toast({
        title: "Nessun dato",
        description: "Non ci sono lead da esportare",
        variant: "destructive",
      });
      return;
    }

    exportLeadsToExcel(filteredLeads, `leads-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({
      title: "Export completato",
      description: "I lead sono stati esportati in Excel",
    });
  };

  const handleGeneratePDF = (lead: Lead) => {
    generateQuotePDF(lead);
    toast({
      title: "PDF generato",
      description: "Il preventivo PDF è stato generato",
    });
  };

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailModalOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({ ...(lead.customer || {}) });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLead) return;

    try {
      const updatedLead = {
        ...editingLead,
        customer: editForm
      };

      await updateDoc(doc(db, "leads", editingLead.id), {
        customer: editForm,
        updatedAt: Timestamp.now()
      });

      toast({
        title: "Lead aggiornato",
        description: "I dati del lead sono stati aggiornati con successo",
      });

      setIsEditModalOpen(false);
      setEditingLead(null);
      setEditForm({});

    } catch (error) {
      console.error("Error updating lead:", error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento del lead",
        variant: "destructive",
      });
    }
  };

  const handleEditFormChange = (field: keyof Customer, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClearAllLeads = async () => {
    const confirmed = window.confirm(
      '⚠️ ATTENZIONE: Questa azione cancellerà TUTTI i lead dal database.\n\nQuesta azione è irreversibile!\n\nVuoi davvero continuare?'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      '🚨 ULTIMA CONFERMA: Stai per cancellare TUTTI i lead.\n\nSei assolutamente sicuro?'
    );

    if (!doubleConfirm) return;

    try {
      await clearAllLeads();
      toast({
        title: "Lead cancellati",
        description: "Tutti i lead sono stati cancellati con successo. L'admin panel ora dovrebbe funzionare correttamente.",
      });

      // Refresh della pagina per aggiornare la lista
      window.location.reload();

    } catch (error) {
      console.error('Errore durante la cancellazione dei lead:', error);
      toast({
        title: "Errore",
        description: "Errore durante la cancellazione dei lead. Riprova.",
        variant: "destructive",
      });
    }
  };

  const openEmailCompose = async (lead: Lead) => {
    const customer = lead.customer || {};
    const email = customer.email;

    if (!email) {
      toast({
        title: "Email mancante",
        description: "Questo lead non ha un indirizzo email",
        variant: "destructive",
      });
      return;
    }

    // Carica le impostazioni dello studio da Firestore
    let studioSettings: Settings | null = null;
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "app"));
      if (settingsDoc.exists()) {
        studioSettings = settingsDoc.data() as Settings;
      }
    } catch (error) {
      console.error("Error loading studio settings:", error);
    }

    // Crea oggetto email
    const subject = `Preventivo ${customer.nome || ''} ${customer.cognome || ''} - ${format(new Date(), 'dd/MM/yyyy')}`;

    // Crea corpo email con dettagli preventivo
    const bodyLines = [
      `Gentile ${customer.nome || 'Cliente'},`,
      '',
      'La ringraziamo per l\'interesse mostrato nei nostri servizi.',
      'Di seguito trova il dettaglio del preventivo richiesto:',
      '',
      '═══════════════════════════════════════════════',
      '                    PREVENTIVO',
      '═══════════════════════════════════════════════',
      '',
      '📍 STUDIO INFORMAZIONI:',
      `   Nome: ${studioSettings?.studioName || 'Studio Non Configurato'}`,
      `   Indirizzo: ${studioSettings?.studioAddress || 'Indirizzo non configurato'}`,
      `   Telefono: ${studioSettings?.phoneNumber || 'Telefono non configurato'}`,
      `   Email: ${studioSettings?.email || 'Email non configurata'}`,
      '',
      '👤 CLIENTE:',
      `   Nome: ${customer.nome || 'N/A'}`,
      `   Cognome: ${customer.cognome || 'N/A'}`,
      `   Email: ${customer.email || 'N/A'}`,
      `   Telefono: ${customer.telefono || 'N/A'}`,
      '',
      '🛍️ SERVIZI/PRODOTTI SELEZIONATI:',
      ''
    ];

    // Aggiungi items con logica regalo
    lead.selectedItems.forEach((item, index) => {
      bodyLines.push(`${index + 1}. ${item.title}`);
      
      // Determina se è un regalo (prezzo 0)
      const isGift = item.price === 0;
      
      if (isGift) {
        // Item regalo: mostra prezzo originale e "GRATIS"
        bodyLines.push(`   Prezzo originale: €${(item.originalPrice || 0).toLocaleString('it-IT')}`);
        bodyLines.push(`   🎁 GRATIS (Servizio in omaggio)`);
      } else if (item.originalPrice && item.originalPrice !== item.price) {
        // Item scontato: mostra prezzo originale e scontato
        bodyLines.push(`   Prezzo originale: €${item.originalPrice.toLocaleString('it-IT')}`);
        bodyLines.push(`   Prezzo scontato: €${item.price.toLocaleString('it-IT')}`);
        bodyLines.push(`   Risparmio: €${(item.originalPrice - item.price).toLocaleString('it-IT')}`);
      } else {
        // Item normale: solo prezzo
        bodyLines.push(`   Prezzo: €${item.price.toLocaleString('it-IT')}`);
      }
      bodyLines.push('');
    });

    // Aggiungi totali con nuova struttura dettagliata
    bodyLines.push('═══════════════════════════════════════════════');
    bodyLines.push('💰 RIEPILOGO PREZZI:');
    bodyLines.push('');
    bodyLines.push(`Subtotale servizi/prodotti: €${(lead.pricing.subtotal || 0).toLocaleString('it-IT')}`);

    // Sconti individuali per prodotto/servizio - usa detailed se disponibile
    const individualSavings = (lead.pricing as any).detailed?.individualDiscountSavings || 0;
    if (individualSavings > 0) {
      bodyLines.push(`Sconti per prodotto/servizio: -€${individualSavings.toLocaleString('it-IT')}`);
    }

    // Sconto globale - usa detailed se disponibile
    const globalSavings = (lead.pricing as any).detailed?.globalDiscountSavings || 0;
    if (globalSavings > 0) {
      bodyLines.push(`Sconto globale (-10%): -€${globalSavings.toLocaleString('it-IT')}`);
    }

    // Servizi in omaggio
    if ((lead.pricing.giftSavings || 0) > 0) {
      bodyLines.push(`Servizi in omaggio: -€${(lead.pricing.giftSavings || 0).toLocaleString('it-IT')}`);
    }

    bodyLines.push('');
    bodyLines.push(`🎯 TOTALE FINALE: €${(lead.pricing.total || 0).toLocaleString('it-IT')}`);
    
    // Totale risparmiato
    if ((lead.pricing.totalSavings || 0) > 0) {
      bodyLines.push(`💰 Totale risparmiato: €${(lead.pricing.totalSavings || 0).toLocaleString('it-IT')}!`);
    }
    
    bodyLines.push('═══════════════════════════════════════════════');
    bodyLines.push('');
    bodyLines.push('📝 Note:');
    bodyLines.push('- Preventivo valido 30 giorni');
    bodyLines.push('- I prezzi sono comprensivi di IVA');
    bodyLines.push('- Per qualsiasi chiarimento non esiti a contattarci');
    bodyLines.push('');
    bodyLines.push('Restiamo a disposizione per qualsiasi informazione.');
    bodyLines.push('');
    bodyLines.push('Cordiali saluti,');
    bodyLines.push(`${studioSettings?.studioName || 'Il tuo studio'}`);

    const body = bodyLines.join('\n');

    // Crea link Gmail web compose
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Apri Gmail web in nuova tab
    window.open(gmailUrl, '_blank');

    // Aggiorna lo stato del lead a "Email Inviata"
    try {
      await updateDoc(doc(db, "leads", lead.id), { 
        status: "email_sent",
        emailSentAt: Timestamp.now()
      });

      toast({
        title: "Gmail aperto",
        description: "Gmail web è stato aperto e lo stato del lead è stato aggiornato",
      });
    } catch (error) {
      console.error("Error updating lead status:", error);
      toast({
        title: "Gmail aperto",
        description: "Gmail web è stato aperto ma errore nell'aggiornamento stato",
        variant: "destructive",
      });
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Calculate stats from filtered leads con nuova struttura
  const stats = {
    total: filteredLeads.length,
    totalValue: filteredLeads.reduce((sum, lead) => sum + (lead.pricing?.total || 0), 0),
    totalSavings: filteredLeads.reduce((sum, lead) => sum + (lead.pricing?.totalSavings || 0), 0),
    avgValue: filteredLeads.length > 0 ? filteredLeads.reduce((sum, lead) => sum + (lead.pricing?.total || 0), 0) / filteredLeads.length : 0
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const getStatusBadge = (status: Lead["status"]) => {
    switch (status) {
      case "new":
        return <Badge className="bg-blue-100 text-white">Nuovo</Badge>;
      case "contacted":
        return <Badge className="bg-yellow-100 text-white">Contattato</Badge>;
      case "quoted":
        return <Badge className="bg-purple-100 text-white">Preventivato</Badge>;
      case "closed":
        return <Badge className="bg-green-100 text-white">Chiuso</Badge>;
      default:
        return <Badge variant="secondary">Sconosciuto</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-8 shadow-2xl border border-white/20 backdrop-blur-lg" 
           style={{
             background: `linear-gradient(135deg, 
               var(--brand-accent) 0%, 
               rgba(var(--brand-accent-rgb, 18, 52, 88), 0.9) 50%, 
               rgba(var(--brand-secondary-rgb, 212, 201, 190), 0.3) 100%)`,
           }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                 style={{ 
                   background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(255,255,255,0.3)'
                 }}>
              <Users className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-2xl">
                Gestione Lead
              </h2>
              <p className="text-white/80 text-lg font-medium mt-1 drop-shadow-lg">
                Monitora e gestisci i contatti clienti
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handleClearAllLeads}
              className="relative px-6 py-3 text-base font-bold text-white rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c, #991b1b)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)'
              }}
            >
              {/* Animated background for button */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>

              <div className="relative z-10 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Cancella Tutti
              </div>
            </Button>
            <Button
              onClick={handleExportExcel}
              className="relative px-6 py-3 text-base font-bold text-white rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669, #047857)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)'
              }}
            >
              {/* Animated background for button */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>

              <div className="relative z-10 flex items-center">
                <Download className="w-5 h-5 mr-2" />
                Export Excel
              </div>
            </Button>
          </div>
        </div>

        {/* Decorative glow effect */}
        <div className="absolute inset-0 rounded-2xl shadow-inner" 
             style={{ 
               boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)' 
             }}></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-premium hover-lift">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gradient">{stats.total}</div>
            <p className="text-sm font-semibold mt-2" style={{ color: 'var(--brand-accent)' }}>Lead Totali</p>
          </CardContent>
        </Card>
        <Card className="card-premium hover-lift">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gradient">
              €{stats.totalValue.toLocaleString('it-IT')}
            </div>
            <p className="text-sm font-semibold mt-2" style={{ color: 'var(--brand-accent)' }}>Valore Totale</p>
          </CardContent>
        </Card>
        <Card className="card-premium hover-lift">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gradient">
              €{stats.totalSavings.toLocaleString('it-IT')}
            </div>
            <p className="text-sm font-semibold mt-2" style={{ color: 'var(--brand-accent)' }}>Risparmi Totali</p>
          </CardContent>
        </Card>
        <Card className="card-premium hover-lift">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gradient">
              €{stats.avgValue.toLocaleString('it-IT')}
            </div>
            <p className="text-sm font-semibold mt-2" style={{ color: 'var(--brand-accent)' }}>Valore Medio</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-premium shadow-elegant">
        <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" style={{ color: 'var(--brand-accent)' }} />
            <span className="text-xl font-bold text-gradient">Filtri</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Cerca</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Nome, email, telefono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Stato</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="new">Nuovo</SelectItem>
                  <SelectItem value="contacted">Contattato</SelectItem>
                  <SelectItem value="email_sent">Email Inviata</SelectItem>
                  <SelectItem value="quoted">Preventivato</SelectItem>
                  <SelectItem value="closed">Chiuso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data Creazione</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? (
                      format(dateFilter, "dd/MM/yyyy", { locale: it })
                    ) : (
                      "Seleziona data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setDateFilter(undefined);
                }}
                className="w-full"
              >
                Reset Filtri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="card-premium shadow-elegant">
        <CardHeader className="glass rounded-t-xl border-b-2" style={{ borderColor: 'var(--brand-accent)' }}>
          <CardTitle className="flex items-center justify-between">
            <span className="text-xl font-bold text-gradient">
              Lead ({filteredLeads.length})
            </span>
            <span className="text-sm font-normal text-gray-600">
              Pagina {currentPage} di {totalPages} - Mostrando {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} di {filteredLeads.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="glass">
                <TableRow>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Cliente</TableHead>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Contatti</TableHead>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Data Evento</TableHead>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Valore</TableHead>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Stato</TableHead>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Data Creazione</TableHead>
                  <TableHead className="font-semibold" style={{ color: 'var(--brand-accent)' }}>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => {
                  let leadDate;
                  let isValidDate = false;

                  try {
                    if (lead.createdAt instanceof Date) {
                      leadDate = lead.createdAt;
                      isValidDate = !isNaN(leadDate.getTime());
                    } else if ((lead.createdAt as any)?.seconds) {
                      leadDate = new Date((lead.createdAt as any).seconds * 1000);
                      isValidDate = !isNaN(leadDate.getTime());
                    } else if (lead.createdAt) {
                      leadDate = new Date(lead.createdAt);
                      isValidDate = !isNaN(leadDate.getTime());
                    } else {
                      leadDate = new Date();
                      isValidDate = true;
                    }
                  } catch (e) {
                    leadDate = new Date();
                    isValidDate = true;
                  }

                  return (
                    <TableRow key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {(lead.customer?.nome || 'Cliente')} {(lead.customer?.cognome || 'Anonimo')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {lead.selectedItems?.length || 0} item{(lead.selectedItems?.length || 0) !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.customer?.email && (
                            <div className="flex items-center space-x-1 text-sm">
                              <Mail className="w-3 h-3" />
                              <span>{lead.customer.email}</span>
                            </div>
                          )}
                          {lead.customer?.telefono && (
                            <div className="flex items-center space-x-1 text-sm">
                              <Phone className="w-3 h-3" />
                              <span>{lead.customer.telefono}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.customer?.data_evento && (
                          <div className="flex items-center space-x-1 text-sm">
                            <CalendarDays className="w-3 h-3" />
                            <span>{lead.customer.data_evento}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">€{(lead.pricing?.total || 0).toLocaleString('it-IT')}</div>
                          {(lead.pricing?.discount || 0) > 0 && (
                            <div className="text-sm text-green-600">
                              -€{(lead.pricing.discount || 0).toLocaleString('it-IT')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(value: Lead["status"]) => updateLeadStatus(lead.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Nuovo</SelectItem>
                            <SelectItem value="contacted">Contattato</SelectItem>
                            <SelectItem value="email_sent">Email Inviata</SelectItem>
                            <SelectItem value="quoted">Preventivato</SelectItem>
                            <SelectItem value="closed">Chiuso</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {isValidDate ? format(leadDate, "dd/MM/yyyy", { locale: it }) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isValidDate ? format(leadDate, "HH:mm", { locale: it }) : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openLeadDetail(lead)}
                            title="Visualizza dettagli"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(lead)}
                            title="Modifica lead"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGeneratePDF(lead)}
                            title="Genera PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEmailCompose(lead)}
                            title="Invia email preventivo"
                            disabled={!lead.customer?.email}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteLead(lead.id)}
                            title="Elimina lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Card className="card-premium shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-1"
                >
                  <span>‹</span>
                  <span>Precedente</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center space-x-1"
                >
                  <span>Successivo</span>
                  <span>›</span>
                </Button>
              </div>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 7) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 4) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNumber = totalPages - 6 + i;
                  } else {
                    pageNumber = currentPage - 3 + i;
                  }

                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNumber)}
                      className={`w-10 h-10 ${
                        currentPage === pageNumber 
                          ? 'bg-brand-accent text-white' 
                          : 'hover:bg-brand-accent/10'
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
              </div>

              <div className="text-sm text-gray-600">
                {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} di {filteredLeads.length}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--brand-primary)' }}>
          <DialogHeader>
            <DialogTitle>
              Dettagli Lead - {selectedLead?.customer?.nome || ''} {selectedLead?.customer?.cognome || ''}
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informazioni Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedLead.customer)
                      .filter(([key]) => key !== 'gdpr_consent')
                      .map(([key, value]) => (
                        <div key={key}>
                          <Label className="text-sm font-medium text-gray-500">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Label>
                          <div className="mt-1">{value || 'N/A'}</div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Selected Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Servizi/Prodotti Selezionati</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedLead.selectedItems.map((item, index) => {
                      const isGift = item.price === 0;
                      const originalPrice = item.originalPrice || 0;
                      const hasDiscount = originalPrice > 0 && originalPrice !== item.price;
                      
                      return (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {item.title}
                              {isGift && <Badge variant="secondary" className="bg-green-100 text-green-800">🎁 GRATIS</Badge>}
                            </div>
                            {hasDiscount && (
                              <div className="text-sm text-gray-500">
                                Prezzo originale: €{originalPrice.toLocaleString('it-IT')}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {isGift ? (
                              <div>
                                <div className="font-bold text-green-600">GRATIS</div>
                                {originalPrice > 0 && (
                                  <div className="text-sm line-through text-gray-400">
                                    €{originalPrice.toLocaleString('it-IT')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold">€{item.price.toLocaleString('it-IT')}</div>
                                {hasDiscount && (
                                  <div className="text-sm text-green-600">
                                    Sconto: €{(originalPrice - item.price).toLocaleString('it-IT')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotale servizi/prodotti:</span>
                        <span>€{selectedLead.pricing.subtotal.toLocaleString('it-IT')}</span>
                      </div>
                      
                      {/* Sconti individuali */}
                      {((selectedLead.pricing as any).detailed?.individualDiscountSavings || 0) > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>Sconti per prodotto/servizio:</span>
                          <span>-€{((selectedLead.pricing as any).detailed.individualDiscountSavings || 0).toLocaleString('it-IT')}</span>
                        </div>
                      )}
                      
                      {/* Sconto globale */}
                      {((selectedLead.pricing as any).detailed?.globalDiscountSavings || 0) > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>Sconto globale (-10%):</span>
                          <span>-€{((selectedLead.pricing as any).detailed.globalDiscountSavings || 0).toLocaleString('it-IT')}</span>
                        </div>
                      )}
                      
                      {/* Servizi in omaggio */}
                      {(selectedLead.pricing.giftSavings || 0) > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Servizi in omaggio:</span>
                          <span>-€{(selectedLead.pricing.giftSavings || 0).toLocaleString('it-IT')}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>TOTALE:</span>
                        <span>€{selectedLead.pricing.total.toLocaleString('it-IT')}</span>
                      </div>
                      
                      {/* Totale risparmiato */}
                      {(selectedLead.pricing.totalSavings || 0) > 0 && (
                        <div className="flex justify-between text-green-700 font-semibold">
                          <span>💰 Totale risparmiato:</span>
                          <span>€{(selectedLead.pricing.totalSavings || 0).toLocaleString('it-IT')}!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* GDPR Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Consenso GDPR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={selectedLead.gdprConsent?.accepted ? "default" : "destructive"}>
                        {selectedLead.gdprConsent?.accepted ? "Accettato" : "Rifiutato"}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {selectedLead.gdprConsent?.timestamp && format(
                          selectedLead.gdprConsent.timestamp instanceof Date 
                            ? selectedLead.gdprConsent.timestamp 
                            : new Date(selectedLead.gdprConsent.timestamp),
                          "dd/MM/yyyy HH:mm",
                          { locale: it }
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {selectedLead.gdprConsent?.text || 'Nessun testo consenso disponibile'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lead Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-brand-primary">
          <DialogHeader>
            <DialogTitle>
              Modifica Lead - {editingLead?.customer?.nome || ''} {editingLead?.customer?.cognome || ''}
            </DialogTitle>
          </DialogHeader>

          {editingLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(editingLead.customer)
                  .filter(([key]) => key !== 'gdpr_consent')
                  .map(([key, value]) => (
                    <div key={key}>
                      <Label htmlFor={`edit-${key}`} className="text-sm font-medium">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <Input
                        id={`edit-${key}`}
                        value={(editForm as any)[key] || ''}
                        onChange={(e) => handleEditFormChange(key as keyof Customer, e.target.value)}
                        className="mt-1"
                        placeholder={`Inserisci ${key.replace(/_/g, ' ')}`}
                      />
                    </div>
                  ))}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingLead(null);
                    setEditForm({});
                  }}
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="bg-brand-accent hover:bg-brand-accent/90"
                >
                  Salva Modifiche
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}