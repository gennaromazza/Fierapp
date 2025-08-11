import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { Settings, Discounts } from "@shared/schema";
import { Camera, Settings as SettingsIcon, Clock, Percent } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";

type TabType = "servizi" | "prodotti";

interface HeaderProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export default function Header({ activeTab = "servizi", onTabChange }: HeaderProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Discounts | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          const settingsData = settingsDoc.data() as Settings;
          setSettings(settingsData);
          
          // Apply brand colors to CSS variables
          if (settingsData.brandPrimary || settingsData.brandSecondary || settingsData.brandAccent) {
            const root = document.documentElement;
            if (settingsData.brandPrimary) {
              root.style.setProperty('--brand-primary', settingsData.brandPrimary);
            }
            if (settingsData.brandSecondary) {
              root.style.setProperty('--brand-secondary', settingsData.brandSecondary);
            }
            if (settingsData.brandAccent) {
              root.style.setProperty('--brand-accent', settingsData.brandAccent);
            }
          }

          // Load logo from Firebase Storage if configured
          if (settingsData.logoUrl) {
            try {
              const logoRef = ref(storage, settingsData.logoUrl);
              const url = await getDownloadURL(logoRef);
              setLogoUrl(url);
            } catch (error) {
              console.error("Error loading logo:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }

    async function loadDiscounts() {
      try {
        const discountsDoc = await getDoc(doc(db, "settings", "discounts"));
        if (discountsDoc.exists()) {
          const discountsData = discountsDoc.data() as Discounts;
          setDiscounts(discountsData);
        }
      } catch (error) {
        console.error("Error loading discounts:", error);
      }
    }
    
    loadSettings();
    loadDiscounts();
  }, []);

  return (
    <header className="sticky top-0 z-50 glass shadow-elegant"
            style={{ 
              borderBottom: `2px solid var(--brand-secondary)`
            }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo Section */}
          <div className="flex items-center space-x-4 group cursor-pointer">
            {/* Studio logo */}
            <div className="w-14 h-14 rounded-xl gradient-accent flex items-center justify-center overflow-hidden shadow-glow animate-float"
                 style={{ backgroundColor: 'var(--brand-accent)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Studio Logo" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <Camera className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gradient">
                {settings?.studioName || "STUDIO DEMO"}
              </h1>
              <p className="text-sm opacity-80" style={{ color: 'var(--brand-accent)' }}>
                Servizi professionali per eventi
              </p>
            </div>
          </div>
          
          {/* Navigation */}
          {onTabChange && (
            <nav className="hidden md:flex items-center space-x-6">
              <button
                className={`font-medium pb-1 transition-colors`}
                style={activeTab === "servizi" ? {
                  color: 'var(--brand-accent)',
                  borderBottom: `2px solid var(--brand-accent)`
                } : {
                  color: '#4B5563'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "servizi") {
                    e.currentTarget.style.color = 'var(--brand-accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "servizi") {
                    e.currentTarget.style.color = '#4B5563';
                  }
                }}
                onClick={() => onTabChange("servizi")}
              >
                SERVIZI
              </button>
              <button
                className={`font-medium pb-1 transition-colors`}
                style={activeTab === "prodotti" ? {
                  color: 'var(--brand-accent)',
                  borderBottom: `2px solid var(--brand-accent)`
                } : {
                  color: '#4B5563'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "prodotti") {
                    e.currentTarget.style.color = 'var(--brand-accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "prodotti") {
                    e.currentTarget.style.color = '#4B5563';
                  }
                }}
                onClick={() => onTabChange("prodotti")}
              >
                PRODOTTI
              </button>
            </nav>
          )}
          
          {/* Admin Link */}
          <a
            href={window.location.pathname.includes('/fiera') ? "/fiera/admin" : "/admin"}
            className="text-sm transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-accent)'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
          >
            <SettingsIcon className="w-4 h-4" />
          </a>
        </div>
        
        {/* Mobile Navigation */}
        {onTabChange && (
          <div className="md:hidden pb-3">
            <div className="flex space-x-1 bg-brand-secondary/30 rounded-lg p-1">
              <button
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                  activeTab === "servizi"
                    ? "bg-white text-brand-accent shadow-sm"
                    : "text-gray-600"
                }`}
                onClick={() => onTabChange("servizi")}
              >
                SERVIZI
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                  activeTab === "prodotti"
                    ? "bg-white text-brand-accent shadow-sm"
                    : "text-gray-600"
                }`}
                onClick={() => onTabChange("prodotti")}
              >
                PRODOTTI
              </button>
            </div>
          </div>
        )}

        {/* Global Discount Banner */}
        {discounts?.global?.isActive && discounts.global.value > 0 && (
          <div className="py-2 px-4 bg-brand-accent/10 border-t border-brand-border">
            <div className="flex items-center justify-center space-x-2 text-sm">
              <Percent className="w-4 h-4 text-brand-accent" />
              <span className="font-semibold text-brand-text-accent">
                Sconto globale attivo: {discounts.global.type === "percent" ? `${discounts.global.value}%` : `€${discounts.global.value}`}
              </span>
              {discounts.global.endDate && isBefore(new Date(), discounts.global.endDate) && (
                <div className="flex items-center space-x-1 text-brand-text-secondary">
                  <Clock className="w-3 h-3" />
                  <span>
                    Scade: {format(discounts.global.endDate, "d MMM yyyy", { locale: it })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
