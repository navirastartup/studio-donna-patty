"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [systemName, setSystemName] = useState("Studio Donna Patty");
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const { data: nameData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "system_name")
        .single();
      if (nameData?.value) {
        setSystemName(nameData.value);
      }

      const { data: logoData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "system_logo_url")
        .single();
      if (logoData?.value) {
        setSystemLogoUrl(logoData.value);
      }
      setLoading(false);
    }

    fetchSettings();
  }, []);

  return (
    <html lang="pt-BR">
      <head>
        <title>{systemName}</title>
        {systemLogoUrl && <link rel="icon" href={systemLogoUrl} />}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark min-h-screen flex flex-col`}
      >
        {/* Header global */}
        <header className="w-full bg-gray-900 text-white p-4 shadow-lg sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              {systemLogoUrl ? (
                <Image
                  src={systemLogoUrl}
                  alt={`${systemName} Logo`}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-[#D6C6AA] rounded-full flex items-center justify-center text-black font-bold">
                  SDP
                </div>
              )}
              <span className="text-xl font-bold text-[#D6C6AA]">{systemName}</span>
            </Link>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="w-full bg-gray-900 text-gray-400 p-4 text-center text-sm mt-auto">
          © {new Date().getFullYear()} {systemName}. Todos os direitos reservados Azyra Sistemas.
        </footer>
      </body>
    </html>
  );
}
