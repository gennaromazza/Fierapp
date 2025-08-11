import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import Header from "../components/Header";
import ItemManagement from "../components/admin/ItemManagement";
import DiscountManagement from "../components/admin/DiscountManagement";
import SettingsManagement from "../components/admin/SettingsManagement";
import LeadsManagement from "../components/admin/LeadsManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Percent, Settings, Users, LogOut } from "lucide-react";

export default function Admin() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Maintain the current path structure (with or without /fiera)
      const currentPath = window.location.pathname;
      const isUsingFieraPrefix = currentPath.includes('/fiera');
      setLocation(isUsingFieraPrefix ? "/fiera/admin/login" : "/admin/login");
    }
  }, [user, loading, setLocation]);

  const handleSignOut = async () => {
    await signOut();
    // Maintain the current path structure (with or without /fiera)
    const currentPath = window.location.pathname;
    const isUsingFieraPrefix = currentPath.includes('/fiera');
    setLocation(isUsingFieraPrefix ? "/fiera/admin/login" : "/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-primary)' }}>
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-accent)' }}>Pannello Amministrazione</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Esci</span>
          </button>
        </div>

        <Tabs defaultValue="items" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" style={{ backgroundColor: 'white', borderColor: 'var(--brand-secondary)' }}>
            <TabsTrigger value="items" className="flex items-center space-x-2 data-[state=active]:bg-brand-accent data-[state=active]:text-white">
              <ShoppingBag className="w-4 h-4" />
              <span>Items</span>
            </TabsTrigger>
            <TabsTrigger value="discounts" className="flex items-center space-x-2 data-[state=active]:bg-brand-accent data-[state=active]:text-white">
              <Percent className="w-4 h-4" />
              <span>Sconti</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2 data-[state=active]:bg-brand-accent data-[state=active]:text-white">
              <Settings className="w-4 h-4" />
              <span>Impostazioni</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center space-x-2 data-[state=active]:bg-brand-accent data-[state=active]:text-white">
              <Users className="w-4 h-4" />
              <span>Lead</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <ItemManagement />
          </TabsContent>

          <TabsContent value="discounts">
            <DiscountManagement />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsManagement />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
