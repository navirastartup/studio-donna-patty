"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [systemName, setSystemName] = useState("Studio Donna Patty");
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      const { data: nameData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "system_name")
        .single();

      if (nameData?.value) setSystemName(nameData.value);

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
      <head>
        <title>{systemName}</title>
        {systemLogoUrl && <link rel="icon" href={systemLogoUrl} />}
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-transparent`}>
        {/* NÃO TEM HEADER AQUI */}

        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
