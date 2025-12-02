"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "./globals.css";

import { CartProvider } from "@/context/CartContext";
import { Toaster } from "react-hot-toast";
import TopButtons from "@/components/TopButtons";
import SystemInfoModal from "@/components/SystemInfoModal";

import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hideCartByComponent, setHideCartByComponent] = useState(false);

  useEffect(() => {
    (window as any).__HIDE_CART__ = () => setHideCartByComponent(true);
  }, []);

  const hideCartByRoute =
    pathname.includes("loading") ||
    pathname.startsWith("/success") ||
    pathname.startsWith("/failure") ||
    pathname.startsWith("/carrinho/finalizar") ||
    pathname.startsWith("/agendamento-unico");

  const hideCart = hideCartByRoute || hideCartByComponent;
  const showSystemInfoButton = pathname === "/";

  useEffect(() => {
    async function fetchSettings() {
      const { data: logoData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "system_logo_url")
        .single();

      if (logoData?.value) setSystemLogoUrl(logoData.value);
    }
    fetchSettings();
  }, []);

  return (
    <html lang="pt-BR">
      <head>{systemLogoUrl && <link rel="icon" href={systemLogoUrl} />}</head>

      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen`}>
        <CartProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#111",
                border: "1px solid #E8DCC3",
                color: "#E8DCC3",
              },
            }}
          />

          {/* 🔥 COMPONENTE QUE USA O CART AGORA ESTÁ DENTRO DO PROVIDER */}
          <TopButtons
            showSystemInfoButton={showSystemInfoButton}
            hideCart={hideCart}
            onOpenInfo={() => setInfoOpen(true)}
          />

          <SystemInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />

          <div>{children}</div>
        </CartProvider>
      </body>
    </html>
  );
}
