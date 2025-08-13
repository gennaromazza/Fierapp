import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import ItemCard from './ItemCard';
import type { Item } from '../../../shared/schema';

interface CarouselNavigationContextType {
  currentSlide: number;
  goToSlide: (slideIndex: number) => void;
  findItemSlide: (itemId: string) => number | null;
}

export const CarouselNavigationContext = React.createContext<CarouselNavigationContextType | null>(null);

export const useCarouselNavigation = () => {
  const context = React.useContext(CarouselNavigationContext);
  if (!context) {
    throw new Error('useCarouselNavigation must be used within CarouselNavigationProvider');
  }
  return context;
};

export default function ProductCarousel() {
  const [api, setApi] = useState<any>();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Fetch items from Firestore
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', 'active'],
    queryFn: async () => {
      try {
        const itemsQuery = query(
          collection(db, 'items'),
          where('active', '==', true)
        );
        const snapshot = await getDocs(itemsQuery);

        const loadedItems = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            price: data.price || 0,
            category: data.category || 'prodotto',
            active: data.active !== false,
            sortOrder: data.sortOrder || 0,
            description: data.description,
            originalPrice: data.originalPrice,
            imageUrl: data.imageUrl,
            subtitle: data.subtitle,
            ruleSettings: data.ruleSettings,
            mutuallyExclusiveWith: data.mutuallyExclusiveWith,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Item;
        });

        // Sort by sortOrder
        loadedItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        return loadedItems;
      } catch (error) {
        console.error('Error loading items:', error);
        return [];
      }
    },
  });

  // Set up carousel API
  useEffect(() => {
    if (!api) return;

    setCurrentSlide(api.selectedScrollSnap());

    api.on('select', () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

  // Navigation functions
  const goToSlide = (slideIndex: number) => {
    if (api && slideIndex >= 0 && slideIndex < items.length) {
      api.scrollTo(slideIndex);
    }
  };

  const findItemSlide = (itemId: string): number | null => {
    const index = items.findIndex(item => item.id === itemId);
    return index >= 0 ? index : null;
  };

  const contextValue: CarouselNavigationContextType = {
    currentSlide,
    goToSlide,
    findItemSlide,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Nessun prodotto disponibile al momento.</p>
      </div>
    );
  }

  return (
    <CarouselNavigationContext.Provider value={contextValue}>
      <Carousel 
        setApi={setApi} 
        className="w-full max-w-7xl mx-auto"
        opts={{
          align: "start",
          loop: false,
        }}
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {items.map((item) => (
            <CarouselItem 
              key={item.id} 
              className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
            >
              <div data-item-id={item.id}>
                <ItemCard item={item} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </CarouselNavigationContext.Provider>
  );
}