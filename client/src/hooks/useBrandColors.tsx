import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Settings } from "@shared/schema";

/**
 * Hook to automatically apply brand colors from Firebase settings
 * to CSS custom properties for dynamic theming
 */
export function useBrandColors() {
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "app"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const settings = docSnapshot.data() as Settings;
        const root = document.documentElement;
        
        // Apply main brand colors
        if (settings.brandPrimary) {
          root.style.setProperty('--brand-primary', settings.brandPrimary);
          root.style.setProperty('--primary', convertToHSL(settings.brandPrimary));
        }
        if (settings.brandSecondary) {
          root.style.setProperty('--brand-secondary', settings.brandSecondary);
          root.style.setProperty('--secondary', convertToHSL(settings.brandSecondary));
        }
        if (settings.brandAccent) {
          root.style.setProperty('--brand-accent', settings.brandAccent);
          root.style.setProperty('--accent', convertToHSL(settings.brandAccent));
          // Create hover state color (slightly darker)
          const hoverColor = adjustBrightness(settings.brandAccent, -20);
          root.style.setProperty('--brand-hover', hoverColor);
        }
        
        // Apply advanced text colors
        if (settings.brandTextPrimary) {
          root.style.setProperty('--brand-text-primary', settings.brandTextPrimary);
          root.style.setProperty('--foreground', convertToHSL(settings.brandTextPrimary));
        }
        if (settings.brandTextSecondary) {
          root.style.setProperty('--brand-text-secondary', settings.brandTextSecondary);
          root.style.setProperty('--muted-foreground', convertToHSL(settings.brandTextSecondary));
        }
        if (settings.brandTextAccent) {
          root.style.setProperty('--brand-text-accent', settings.brandTextAccent);
        }
        
        // Apply background and surface colors
        if (settings.brandBackground) {
          root.style.setProperty('--brand-background', settings.brandBackground);
          root.style.setProperty('--background', convertToHSL(settings.brandBackground));
        }
        if (settings.brandSurface) {
          root.style.setProperty('--brand-surface', settings.brandSurface);
          root.style.setProperty('--card', convertToHSL(settings.brandSurface));
        }
        if (settings.brandBorder) {
          root.style.setProperty('--brand-border', settings.brandBorder);
          root.style.setProperty('--border', convertToHSL(settings.brandBorder));
        }
        
        // Update ring color for focus states
        if (settings.brandAccent) {
          root.style.setProperty('--ring', convertToHSL(settings.brandAccent));
        }
        
        // Legacy brand-text for backward compatibility
        const legacyTextColor = getContrastColor(settings.brandPrimary || '#F1EFEC');
        root.style.setProperty('--brand-text', legacyTextColor);
      }
    });

    return () => unsubscribe();
  }, []);
}

// Helper function to convert hex to HSL for Tailwind
function convertToHSL(hex: string): string {
  const r = parseInt(hex.substr(1, 2), 16) / 255;
  const g = parseInt(hex.substr(3, 2), 16) / 255;
  const b = parseInt(hex.substr(5, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Helper function to lighten a color
function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + [R, G, B].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Helper function to darken a color
function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + [R, G, B].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Helper function to adjust brightness
function adjustBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
}

// Helper function to get contrast color
function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
}