import { useState, useEffect } from "react";
import { collection, query, orderBy, updateDoc, doc, deleteDoc, where, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Lead } from "@shared/schema";
import { useCollection } from "../../hooks/useFirestore";
import { exportLeadsToExcel } from "../../lib/exportExcel";
import { generateQuotePDF } from "../../lib/pdf";
import { useToast } from "@/hooks/use-toast";
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
  Calendar as CalendarDays
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function LeadsManagement() {
  const { data: allLeads, loading } = useCollection<Lead>("leads");
  const { toast } = useToast();
  
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (!allLeads) return;
    
    let filtered = allLeads;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead => {
        const customer = lead.customer || {};
        return (
          (customer.nome || customer.Nome || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (customer.cognome || customer.Cognome || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (customer.email || customer.Email || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (customer.telefono || customer.Telefono || '')?.includes(searchTerm) ||
          // Also search in form data keys
          Object.values(customer).some(value => 
            typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
          )
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
                          lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000) :
                          new Date(lead.createdAt);
          return format(leadDate, "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd");
        } catch (e) {
          return false;
        }
      });
    }

    setFilteredLeads(filtered);
  }, [allLeads, searchTerm, statusFilter, dateFilter]);

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

  // Calculate stats from filtered leads
  const stats = {
    total: filteredLeads.length,
    totalValue: filteredLeads.reduce((sum, lead) => sum + (lead.pricing?.total || 0), 0),
    totalDiscount: filteredLeads.reduce((sum, lead) => sum + (lead.pricing?.discount || 0), 0),
    avgValue: filteredLeads.length > 0 ? filteredLeads.reduce((sum, lead) => sum + (lead.pricing?.total || 0), 0) / filteredLeads.length : 0
  };

  const getStatusBadge = (status: Lead["status"]) => {
    switch (status) {
      case "new":
        return <Badge className="bg-blue-100 text-blue-800">Nuovo</Badge>;
      case "contacted":
        return <Badge className="bg-yellow-100 text-yellow-800">Contattato</Badge>;
      case "quoted":
        return <Badge className="bg-purple-100 text-purple-800">Preventivato</Badge>;
      case "closed":
        return <Badge className="bg-green-100 text-green-800">Chiuso</Badge>;
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
      <div className="flex items-center justify-between glass rounded-xl p-6 shadow-elegant">
        <h2 className="text-3xl font-bold text-gradient">Gestione Lead</h2>
        <div className="flex space-x-2">
          <Button onClick={handleExportExcel} className="btn-premium" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
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
              €{stats.totalDiscount.toLocaleString('it-IT')}
            </div>
            <p className="text-sm font-semibold mt-2" style={{ color: 'var(--brand-accent)' }}>Sconti Totali</p>
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
          <CardTitle className="text-xl font-bold text-gradient">Lead ({filteredLeads.length})</CardTitle>
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
                {filteredLeads.map((lead) => {
                  let leadDate;
                  let isValidDate = false;
                  
                  try {
                    if (lead.createdAt instanceof Date) {
                      leadDate = lead.createdAt;
                      isValidDate = !isNaN(leadDate.getTime());
                    } else if (lead.createdAt?.seconds) {
                      leadDate = new Date(lead.createdAt.seconds * 1000);
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
                            {lead.customer?.nome || lead.customer?.Nome || ''} {lead.customer?.cognome || lead.customer?.Cognome || ''}
                          </div>
                          <div className="text-sm text-gray-500">
                            {lead.selectedItems?.length || 0} item{(lead.selectedItems?.length || 0) !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {(lead.customer?.email || lead.customer?.Email) && (
                            <div className="flex items-center space-x-1 text-sm">
                              <Mail className="w-3 h-3" />
                              <span>{lead.customer.email || lead.customer.Email}</span>
                            </div>
                          )}
                          {(lead.customer?.telefono || lead.customer?.Telefono) && (
                            <div className="flex items-center space-x-1 text-sm">
                              <Phone className="w-3 h-3" />
                              <span>{lead.customer.telefono || lead.customer.Telefono}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(lead.customer?.data_evento || lead.customer?.['Data evento']) && (
                          <div className="flex items-center space-x-1 text-sm">
                            <CalendarDays className="w-3 h-3" />
                            <span>{lead.customer.data_evento || lead.customer['Data evento']}</span>
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
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGeneratePDF(lead)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteLead(lead.id)}
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

      {/* Lead Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--brand-primary)' }}>
          <DialogHeader>
            <DialogTitle>
              Dettagli Lead - {selectedLead?.customer.nome} {selectedLead?.customer.cognome}
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
                    {selectedLead.selectedItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          {item.originalPrice && item.originalPrice !== item.price && (
                            <div className="text-sm text-gray-500">
                              Prezzo originale: €{item.originalPrice.toLocaleString('it-IT')}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold">€{item.price.toLocaleString('it-IT')}</div>
                          {item.originalPrice && item.originalPrice !== item.price && (
                            <div className="text-sm text-green-600">
                              Sconto: €{(item.originalPrice - item.price).toLocaleString('it-IT')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotale:</span>
                        <span>€{selectedLead.pricing.subtotal.toLocaleString('it-IT')}</span>
                      </div>
                      {selectedLead.pricing.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Sconto totale:</span>
                          <span>-€{selectedLead.pricing.discount.toLocaleString('it-IT')}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>TOTALE:</span>
                        <span>€{selectedLead.pricing.total.toLocaleString('it-IT')}</span>
                      </div>
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
                      <Badge variant={selectedLead.gdprConsent.accepted ? "default" : "destructive"}>
                        {selectedLead.gdprConsent.accepted ? "Accettato" : "Rifiutato"}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {format(
                          selectedLead.gdprConsent.timestamp instanceof Date 
                            ? selectedLead.gdprConsent.timestamp 
                            : selectedLead.gdprConsent.timestamp.toDate(),
                          "dd/MM/yyyy HH:mm",
                          { locale: it }
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {selectedLead.gdprConsent.text}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
