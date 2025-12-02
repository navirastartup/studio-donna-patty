"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/* 
 Tipagem do item do carrinho
 Cada serviço no carrinho terá:
  - id, name, price (vindos do banco)
  - date e time (selecionados depois pelo usuário)
*/

// context/CartContext.tsx
export interface CartItem {
  id: string;                // UUID único do item do carrinho
  service_id: string;        // ID REAL do serviço da tabela services
  name: string;
  price: number;
  image_url?: string | null;
  duration_minutes?: number | null;
  date?: string | null;
  time?: string | null;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  professional_id?: string | null;
}


interface CartContextType {
  cart: CartItem[];
  addService: (item: CartItem) => void;
  updateService: (id: string, data: Partial<CartItem>) => void;
  removeService: (id: string) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  function addService(item: CartItem) {
    setCart((prev) => [...prev, item]);
  }

  function updateService(id: string, data: Partial<CartItem>) {
    setCart((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...data } : it))
    );
  }

  function removeService(id: string) {
    setCart((prev) => prev.filter((it) => it.id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  return (
    <CartContext.Provider
      value={{ cart, addService, updateService, removeService, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

/*
 Hook para uso do contexto
*/

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve estar dentro de <CartProvider>");
  return ctx;
}
