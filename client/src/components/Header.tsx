import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { Settings, Discounts } from "@shared/schema";
import { Link } from "wouter";
import { Camera, Settings as SettingsIcon, Clock, Percent } from "lucide-react";
import { format, isAfter } from "date-fns";
import { it } from "date-fns/locale";

type TabType = "servizi" | "prodotti";

interface HeaderProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export default function Header({
  activeTab = "servizi",
  onTabChange,
}: HeaderProps) {
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
          if (
            settingsData.brandPrimary ||
            settingsData.brandSecondary ||
            settingsData.brandAccent
          ) {
            const root = document.documentElement;
            if (settingsData.brandPrimary) {
              root.style.setProperty(
                "--brand-primary",
                settingsData.brandPrimary,
              );
            }
            if (settingsData.brandSecondary) {
              root.style.setProperty(
                "--brand-secondary",
                settingsData.brandSecondary,
              );
            }
            if (settingsData.brandAccent) {
              root.style.setProperty(
                "--brand-accent",
                settingsData.brandAccent,
              );
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
    <header
      className="sticky top-0 z-50 glass shadow-elegant"
      style={{ borderBottom: `2px solid var(--brand-secondary)` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo Section */}
          <div className="flex items-center space-x-2 sm:space-x-4 group cursor-pointer flex-1 min-w-0">
            <div
              className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl gradient-accent flex items-center justify-center overflow-hidden shadow-glow flex-shrink-0"
              style={{ backgroundColor: "var(--brand-accent)" }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Studio Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-gradient truncate">
                {settings?.studioName || "STUDIO DEMO"}
              </h1>
              <p
                className="text-xs sm:text-sm opacity-80 truncate"
                style={{ color: "var(--brand-accent)" }}
              >
                Servizi professionali per eventi
              </p>
            </div>
          </div>

          {/* Navigation */}
          {onTabChange && (
            <nav className="hidden md:flex items-center space-x-6 flex-shrink-0">
              <button
                className="font-medium pb-1 transition-colors"
                style={
                  activeTab === "servizi"
                    ? {
                        color: "var(--brand-accent)",
                        borderBottom: `2px solid var(--brand-accent)`,
                      }
                    : { color: "#4B5563" }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== "servizi")
                    e.currentTarget.style.color = "var(--brand-accent)";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "servizi")
                    e.currentTarget.style.color = "#4B5563";
                }}
                onClick={() => onTabChange("servizi")}
              >
                SERVIZI
              </button>
              <button
                className="font-medium pb-1 transition-colors"
                style={
                  activeTab === "prodotti"
                    ? {
                        color: "var(--brand-accent)",
                        borderBottom: `2px solid var(--brand-accent)`,
                      }
                    : { color: "#4B5563" }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== "prodotti")
                    e.currentTarget.style.color = "var(--brand-accent)";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "prodotti")
                    e.currentTarget.style.color = "#4B5563";
                }}
                onClick={() => onTabChange("prodotti")}
              >
                PRODOTTI
              </button>
            </nav>
          )}

          {/* Navigation Actions */}
          <div className="flex items-center space-x-1 sm:space-x-3 flex-shrink-0">
            {/* Special Offers Button */}
            <button
              id="header-offers-button"
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 transition-all duration-200 text-xs sm:text-sm"
              style={{ color: "var(--brand-accent)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--brand-accent)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(34, 197, 94, 0.1)";
                e.currentTarget.style.color = "var(--brand-accent)";
              }}
            >
              <span className="text-sm sm:text-lg">🎁</span>
              <span className="hidden sm:inline font-medium">Offerte</span>
            </button>

            {/* Admin Link */}
            <Link
              href="/admin"
              className="text-sm transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-gray-100"
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.color = "var(--brand-accent)")
              }
              onMouseLeave={(e: any) => (e.currentTarget.style.color = "#6B7280")}
              style={{ color: "#6B7280" }}
            >
              <SettingsIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Link>
          </div>
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
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm">
              <div className="flex items-center space-x-2">
                <Percent className="w-3 h-3 sm:w-4 sm:h-4 text-brand-accent" />
                <span className="font-semibold text-brand-text-accent text-center">
                  Sconto globale attivo:{" "}
                  {discounts.global.type === "percent"
                    ? `${discounts.global.value}%`
                    : `€${discounts.global.value}`}
                </span>
              </div>
              {discounts.global?.endDate && (
                <div className="flex items-center space-x-1 text-brand-text-secondary">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="text-xs sm:text-sm">
                    {(() => {
                      try {
                        let endDate: Date;
                        const rawDate = discounts.global.endDate;

                        if (
                          rawDate &&
                          typeof rawDate === "object" &&
                          "toDate" in rawDate &&
                          typeof rawDate.toDate === "function"
                        ) {
                          endDate = rawDate.toDate();
                        } else if (rawDate instanceof Date) {
                          endDate = rawDate;
                        } else if (rawDate) {
                          endDate = new Date(rawDate);
                        } else {
                          return "";
                        }

                        if (isNaN(endDate.getTime())) return "";

                        const isExpired = isAfter(new Date(), endDate);
                        return isExpired
                          ? `Scaduto: ${format(endDate, "d MMM yyyy", { locale: it })}`
                          : `Scade: ${format(endDate, "d MMM yyyy", { locale: it })}`;
                      } catch (error) {
                        console.error(
                          "Error formatting discount end date:",
                          error,
                        );
                        return "";
                      }
                    })()}
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
