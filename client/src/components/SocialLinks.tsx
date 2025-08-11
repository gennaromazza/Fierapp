import React from "react";
import { Facebook, Instagram, Youtube, Twitter, Linkedin, Music } from "lucide-react";
import { Settings } from "@shared/schema";

// Icona personalizzata per TikTok (non disponibile in Lucide)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.04-.1z" />
  </svg>
);

interface SocialLinksProps {
  socialMedia?: Settings['socialMedia'];
  className?: string;
  iconSize?: string;
  showLabels?: boolean;
  variant?: 'default' | 'footer' | 'header';
}

const socialPlatforms = [
  {
    key: 'facebook' as const,
    icon: Facebook,
    label: 'Facebook',
    color: 'hover:text-blue-600'
  },
  {
    key: 'instagram' as const,
    icon: Instagram,
    label: 'Instagram',
    color: 'hover:text-pink-600'
  },
  {
    key: 'youtube' as const,
    icon: Youtube,
    label: 'YouTube',
    color: 'hover:text-red-600'
  },
  {
    key: 'twitter' as const,
    icon: Twitter,
    label: 'Twitter',
    color: 'hover:text-blue-400'
  },
  {
    key: 'linkedin' as const,
    icon: Linkedin,
    label: 'LinkedIn',
    color: 'hover:text-blue-700'
  },
  {
    key: 'tiktok' as const,
    icon: TikTokIcon,
    label: 'TikTok',
    color: 'hover:text-black'
  }
];

export default function SocialLinks({
  socialMedia,
  className = "",
  iconSize = "w-5 h-5",
  showLabels = false,
  variant = 'default'
}: SocialLinksProps) {
  if (!socialMedia) return null;

  const availableSocials = socialPlatforms.filter(
    platform => socialMedia[platform.key] && socialMedia[platform.key]?.trim()
  );

  if (availableSocials.length === 0) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'footer':
        return "text-gray-300 hover:text-white";
      case 'header':
        return "text-gray-600 hover:text-brand-accent";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {showLabels && (
        <span className="text-sm font-medium">Seguici su:</span>
      )}
      <div className="flex space-x-4">
        {availableSocials.map(({ key, icon: Icon, label, color }) => (
          <a
            key={key}
            href={socialMedia[key]!}
            target="_blank"
            rel="noopener noreferrer"
            className={`${getVariantStyles()} ${color} transition-colors duration-200`}
            title={`Seguici su ${label}`}
            aria-label={`Link a ${label}`}
          >
            <Icon className={iconSize} />
          </a>
        ))}
      </div>
    </div>
  );
}