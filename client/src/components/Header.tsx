import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { Settings } from "@shared/schema";
import { Camera, Settings as SettingsIcon } from "lucide-react";

type TabType = "servizi" | "prodotti";

interface HeaderProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export default function Header({ activeTab = "servizi", onTabChange }: HeaderProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
    
    loadSettings();
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm shadow-sm"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderBottom: `1px solid var(--brand-secondary)`
            }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center space-x-3">
            {/* Studio logo */}
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                 style={{ backgroundColor: 'var(--brand-accent)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Studio Logo" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight"
                  style={{ color: 'var(--brand-accent)' }}>
                {settings?.studioName || "STUDIO DEMO"}
              </h1>
              <p className="text-xs text-gray-600 hidden sm:block">
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
      </div>
    </header>
  );
}
