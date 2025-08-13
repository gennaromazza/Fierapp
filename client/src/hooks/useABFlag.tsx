import { useState, useEffect } from 'react';

interface ABFlags {
  guide_v1: boolean;
}

const defaultFlags: ABFlags = {
  guide_v1: true, // Temporarily enabled for testing
};

export function useABFlag() {
  const [flags, setFlags] = useState<ABFlags>(defaultFlags);

  useEffect(() => {
    // Check localStorage for flag overrides (for testing)
    const storedFlags = localStorage.getItem('ab_flags');
    if (storedFlags) {
      try {
        const parsedFlags = JSON.parse(storedFlags);
        setFlags(prev => ({ ...prev, ...parsedFlags }));
      } catch (error) {
        console.warn('Failed to parse AB flags from localStorage:', error);
      }
    }
  }, []);

  const setFlag = (key: keyof ABFlags, value: boolean) => {
    const newFlags = { ...flags, [key]: value };
    setFlags(newFlags);
    localStorage.setItem('ab_flags', JSON.stringify(newFlags));
  };

  return {
    flags,
    setFlag,
    isEnabled: (key: keyof ABFlags) => flags[key],
  };
}