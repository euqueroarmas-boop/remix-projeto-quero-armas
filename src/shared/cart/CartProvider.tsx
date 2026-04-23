import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import type { CartItem } from '@/shared/types/domain';
import { validateCartAgainstCatalog } from '@/shared/data/catalog';

const STORAGE_KEY = 'eqa.cart.v1';

interface CartContextValue {
  items: CartItem[];
  totalCents: number;
  itemCount: number;
  addItem: (item: CartItem) => void;
  removeItem: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clear: () => void;
  revalidate: () => Promise<{ removed: string[]; updated: string[] }>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const readStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeStorage = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => readStorage());

  useEffect(() => { writeStorage(items); }, [items]);

  const addItem = useCallback((item: CartItem) => {
    // 1 serviço por pedido. Adicionar novo substitui o atual.
    setItems(() => [item]);
  }, []);

  const removeItem = useCallback((serviceId: string) => {
    setItems((prev) => prev.filter((p) => p.service_id !== serviceId));
  }, []);

  const updateQuantity = useCallback((serviceId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((p) => (p.service_id === serviceId ? { ...p, quantity: Math.max(1, quantity) } : p))
        .filter((p) => p.quantity > 0),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const revalidate = useCallback(async () => {
    const ids = items.map((i) => i.service_id);
    const valid = await validateCartAgainstCatalog(ids);
    const removed: string[] = [];
    const updated: string[] = [];
    const next: CartItem[] = [];
    for (const item of items) {
      const fresh = valid.get(item.service_id);
      if (!fresh) { removed.push(item.service_name); continue; }
      if (fresh.base_price_cents !== item.unit_price_cents) updated.push(item.service_name);
      next.push({
        service_id: fresh.id,
        service_slug: fresh.slug,
        service_name: fresh.name,
        unit_price_cents: fresh.base_price_cents,
        quantity: item.quantity,
      });
    }
    setItems(next);
    return { removed, updated };
  }, [items]);

  const totalCents = useMemo(
    () => items.reduce((acc, i) => acc + i.unit_price_cents * i.quantity, 0),
    [items],
  );
  const itemCount = useMemo(
    () => items.reduce((acc, i) => acc + i.quantity, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{ items, totalCents, itemCount, addItem, removeItem, updateQuantity, clear, revalidate }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};