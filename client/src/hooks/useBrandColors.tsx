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
        
        // Apply brand colors to CSS variables
        if (settings.brandPrimary) {
          root.style.setProperty('--brand-primary', settings.brandPrimary);
        }
        if (settings.brandSecondary) {
          root.style.setProperty('--brand-secondary', settings.brandSecondary);
        }
        if (settings.brandAccent) {
          root.style.setProperty('--brand-accent', settings.brandAccent);
        }
      }
    });

    return () => unsubscribe();
  }, []);
}