import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BrandButtonProps extends ButtonProps {
  brandVariant?: 'primary' | 'secondary' | 'accent';
}

export const BrandButton = React.forwardRef<HTMLButtonElement, BrandButtonProps>(
  ({ className, brandVariant = 'accent', style, ...props }, ref) => {
    const getBrandStyles = () => {
      switch (brandVariant) {
        case 'primary':
          return {
            backgroundColor: 'var(--brand-primary)',
            borderColor: 'var(--brand-primary)',
            color: 'var(--brand-text)',
          };
        case 'secondary':
          return {
            backgroundColor: 'var(--brand-secondary)',
            borderColor: 'var(--brand-secondary)',
            color: 'var(--brand-text)',
          };
        case 'accent':
        default:
          return {
            backgroundColor: 'var(--brand-accent)',
            borderColor: 'var(--brand-accent)',
            color: 'white',
          };
      }
    };

    return (
      <Button
        ref={ref}
        className={cn('transition-all duration-300 hover:brightness-110', className)}
        style={{
          ...getBrandStyles(),
          ...style,
        }}
        {...props}
      />
    );
  }
);

BrandButton.displayName = 'BrandButton';