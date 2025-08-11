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
    <div className="min-h-screen gradient-radial">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8 glass rounded-xl p-6 shadow-elegant">
          <h1 className="text-4xl font-bold text-gradient animate-fade-in">Pannello Amministrazione</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const currentPath = window.location.pathname;
                const isUsingFieraPrefix = currentPath.includes('/fiera');
                setLocation(isUsingFieraPrefix ? "/fiera" : "/");
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg glass hover:shadow-elegant transition-all duration-300 hover:scale-105"
              style={{ color: 'var(--brand-accent)' }}
            >
              <span className="font-semibold">Torna Al Sito</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg glass hover:shadow-elegant transition-all duration-300 hover:scale-105"
              style={{ color: 'var(--brand-accent)' }}
            >
              <LogOut className="w-5 h-5" />
              <span className="font-semibold">Esci</span>
            </button>
          </div>
        </div>

        <Tabs defaultValue="items" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 glass rounded-xl p-2 shadow-elegant">
            <TabsTrigger value="items" className="flex items-center space-x-2 rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow hover:scale-105">
              <ShoppingBag className="w-4 h-4" />
              <span>Items</span>
            </TabsTrigger>
            <TabsTrigger value="discounts" className="flex items-center space-x-2 rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow hover:scale-105">
              <Percent className="w-4 h-4" />
              <span>Sconti</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2 rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow hover:scale-105">
              <Settings className="w-4 h-4" />
              <span>Impostazioni</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center space-x-2 rounded-lg font-semibold transition-all duration-300 data-[state=active]:gradient-accent data-[state=active]:text-white data-[state=active]:shadow-glow hover:scale-105">
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
