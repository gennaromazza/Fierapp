import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Settings } from "@shared/schema";
import { Phone, Mail, MessageCircle, MapPin, Clock } from "lucide-react";
import SocialLinks from "./SocialLinks";

export default function Footer() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as Settings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }
    
    loadSettings();
  }, []);

  const generateMapsLink = (address: string) => {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  };

  return (
    <footer className="bg-brand-accent text-white py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Studio Info */}
          <div>
            <h4 className="text-lg font-bold mb-4">
              {settings?.studioName || "STUDIO DEMO"}
            </h4>
            <p className="text-gray-300 mb-4">
              Servizi professionali per eventi speciali. Qualità garantita dal 2010.
            </p>
            
            {/* Social Links */}
            <SocialLinks 
              socialMedia={settings?.socialMedia}
              variant="footer"
              className="mt-4"
            />
          </div>
          
          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-bold mb-4">CONTATTI</h4>
            <div className="space-y-3">
              {settings?.phoneNumber && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-300" />
                  <span>{settings.phoneNumber}</span>
                </div>
              )}
              {settings?.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-300" />
                  <span>{settings.email}</span>
                </div>
              )}
              {settings?.whatsappNumber && (
                <div className="flex items-center space-x-3">
                  <MessageCircle className="w-5 h-5 text-green-400" />
                  <span>WhatsApp: {settings.whatsappNumber}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Studio Location with Maps Integration */}
          <div>
            <h4 className="text-lg font-bold mb-4">DOVE SIAMO</h4>
            <div className="space-y-3">
              {/* Clickable Address for Google Maps */}
              {settings?.studioAddress && (
                <a
                  href={generateMapsLink(settings.studioAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start space-x-3 text-gray-300 hover:text-white transition-colors group"
                >
                  <MapPin className="w-5 h-5 mt-0.5 group-hover:text-blue-400 transition-colors" />
                  <div>
                    <div className="font-medium group-hover:underline">
                      {settings.studioAddress}
                    </div>
                    <div className="text-sm text-blue-300 group-hover:text-blue-200 mt-1">
                      📍 Apri in Google Maps
                    </div>
                  </div>
                </a>
              )}
              
              {/* Business Hours */}
              {settings?.businessHours?.enabled && (
                <div className="flex items-start space-x-3 text-gray-300">
                  <Clock className="w-5 h-5 mt-0.5" />
                  <div>
                    <div className="font-medium">Orari di apertura:</div>
                    {settings.businessHours.weekdays?.enabled && (
                      <div className="text-sm">
                        {settings.businessHours.weekdays.label}: {settings.businessHours.weekdays.open}-{settings.businessHours.weekdays.close}
                      </div>
                    )}
                    {settings.businessHours.saturday?.enabled && (
                      <div className="text-sm">
                        {settings.businessHours.saturday.label}: {settings.businessHours.saturday.open}-{settings.businessHours.saturday.close}
                      </div>
                    )}
                    {settings.businessHours.sunday?.enabled && (
                      <div className="text-sm">
                        {settings.businessHours.sunday.label}: {settings.businessHours.sunday.open}-{settings.businessHours.sunday.close}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Legal Links */}
        <div className="border-t border-gray-600 mt-8 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-300">
            <div className="mb-4 sm:mb-0">
              © 2024 {settings?.studioName || "Studio Demo"}. Tutti i diritti riservati.
            </div>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Termini di Servizio
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
