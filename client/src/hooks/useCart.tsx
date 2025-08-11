import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Cart, CartItem } from "@shared/schema";

interface CartContextType {
  cart: Cart;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  isInCart: (itemId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    itemCount: 0,
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("fiera-cart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      } catch (error) {
        console.error("Error parsing saved cart:", error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("fiera-cart", JSON.stringify(cart));
  }, [cart]);

  const calculateCartTotals = (items: CartItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.originalPrice || item.price), 0);
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const discount = subtotal - total;
    const itemCount = items.length;

    return { subtotal, discount, total, itemCount };
  };

  const addItem = (item: CartItem) => {
    setCart(prevCart => {
      const existingItems = prevCart.items.filter(i => i.id !== item.id);
      const newItems = [...existingItems, item];
      const totals = calculateCartTotals(newItems);

      return {
        items: newItems,
        ...totals,
      };
    });
  };

  const removeItem = (itemId: string) => {
    setCart(prevCart => {
      const newItems = prevCart.items.filter(item => item.id !== itemId);
      const totals = calculateCartTotals(newItems);

      return {
        items: newItems,
        ...totals,
      };
    });
  };

  const updateItem = (itemId: string, updates: Partial<CartItem>) => {
    setCart(prevCart => {
      const newItems = prevCart.items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      const totals = calculateCartTotals(newItems);

      return {
        items: newItems,
        ...totals,
      };
    });
  };

  const clearCart = () => {
    setCart({
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      itemCount: 0,
    });
  };

  const isInCart = (itemId: string) => {
    return cart.items.some(item => item.id === itemId);
  };

  const value = {
    cart,
    addItem,
    removeItem,
    updateItem,
    clearCart,
    isInCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
