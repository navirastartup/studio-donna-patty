"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "./NotificationsContext";

interface ProductLow {
  id: string;
  name: string;
  stock: number;
}

interface LowStockContextValue {
  lowStock: ProductLow[];
  reloadLowStock: () => Promise<void>;
  newAppointmentsCount: number;
  clearNewAppointments: () => void;
  soundEnabled: boolean;
  enableSound: () => void;
}

const LowStockContext = createContext<LowStockContextValue>({
  lowStock: [],
  reloadLowStock: async () => {},
  newAppointmentsCount: 0,
  clearNewAppointments: () => {},
  soundEnabled: false,
  enableSound: () => {},
});

export function LowStockProvider({ children }: { children: React.ReactNode }) {
  const [lowStock, setLowStock] = useState<ProductLow[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const notifiedRef = useRef(false);

  const { addNotification } = useNotifications();

  const [newAppointmentsCount, setNewAppointmentsCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("newAppointmentsCount");
      return stored ? parseInt(stored) : 0;
    }
    return 0;
  });

  useEffect(() => {
    localStorage.setItem("newAppointmentsCount", String(newAppointmentsCount));
  }, [newAppointmentsCount]);

  const clearNewAppointments = () => {
    setNewAppointmentsCount(0);
    localStorage.setItem("newAppointmentsCount", "0");
  };

  const playSound = (file: string) => {
    if (!soundEnabled) return;
    const audio = new Audio(file);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  };

  async function reloadLowStock() {
    try {
      const res = await fetch("/api/estoque", { cache: "no-store" });
      const json = await res.json();
      const data = json?.data || [];

      const lows = data.filter((p: any) => p.stock <= 5);
      setLowStock(lows);

lows.forEach((p: any) => {
  addNotification({
    id: `lowstock-${p.id}`,
    type: "estoque",
    message: `⚠️ Estoque baixo em ${p.name} (${p.stock})`,
    date: new Date().toISOString(),
  });
});


      if (lows.length > 0 && !notifiedRef.current) {
        toast.warning(
          `⚠️ ${lows.length} produto${lows.length > 1 ? "s" : ""} com estoque baixo: ${lows
            .map((p: any) => p.name)
            .join(", ")}`,
          { duration: 6000 }
        );
        playSound("/sounds/alert.mp3");
        notifiedRef.current = true;
      }

      if (lows.length === 0) notifiedRef.current = false;
    } catch (e) {
      console.error("Erro ao carregar estoque baixo:", e);
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel("appointments_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload) => {
          setNewAppointmentsCount((prev) => prev + 1);

          addNotification({
            id: crypto.randomUUID(),
            type: "agendamento",
            message: "Novo agendamento criado!",
            date: new Date().toISOString(),
          });

          toast.success("📅 Novo agendamento criado!", { duration: 4000 });
          playSound("/sounds/notify.mp3");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  useEffect(() => {
    reloadLowStock();
    const interval = setInterval(reloadLowStock, 1000 * 60 * 3);
    return () => clearInterval(interval);
  }, []);

  const enableSound = () => {
    setSoundEnabled(true);
    toast.info("🔔 Sons ativados com sucesso!", { duration: 3000 });
  };

  return (
    <LowStockContext.Provider
      value={{
        lowStock,
        reloadLowStock,
        newAppointmentsCount,
        clearNewAppointments,
        soundEnabled,
        enableSound,
      }}
    >
      {children}
    </LowStockContext.Provider>
  );
}

export function useLowStock() {
  return useContext(LowStockContext);
}
