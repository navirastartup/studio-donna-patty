"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState("pendente");

  useEffect(() => {
    // 🔎 Pegamos o appointment_id da URL (que vem do Mercado Pago)
    const params = new URLSearchParams(window.location.search);
    const appointmentId = params.get("appointment_id");

    if (!appointmentId) return;

    // 👂 Escuta em tempo real a tabela "appointments"
    const channel = supabase
      .channel("public:appointments")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        (payload) => {
          const newStatus = payload.new.payment_status;
          console.log("🔄 Atualização recebida:", newStatus);
          setStatus(newStatus);

          // 🚀 Quando o status mudar pra "pago" → redireciona automaticamente
          if (newStatus === "pago") {
            setTimeout(() => {
              router.push("/success");
            }, 1500);
          }

          // ❌ Se for cancelado ou reembolsado → manda pra tela de erro
          if (["cancelado", "reembolsado"].includes(newStatus)) {
            setTimeout(() => {
              router.push("/failure");
            }, 1500);
          }
        }
      )
      .subscribe();

    // 🧹 Limpeza
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <main className="relative min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-center text-[#E8DCC2] px-6 overflow-hidden">
      {/* Glow amarelo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="w-80 h-80 rounded-full bg-yellow-400/10 blur-3xl animate-pulse"
        />
      </div>

      {/* Ícone */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 10 }}
        className="relative z-10 mb-6"
      >
        <Clock className="w-20 h-20 text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.4)]" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="text-[2.2rem] md:text-4xl font-semibold tracking-tight mb-3"
      >
        {status === "pago"
          ? "Pagamento confirmado!"
          : status === "cancelado"
          ? "Pagamento cancelado"
          : "Pagamento em análise"}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="text-gray-400 max-w-md mb-10 text-lg leading-relaxed"
      >
        {status === "pago"
          ? "Seu agendamento foi confirmado automaticamente."
          : "O Mercado Pago está processando seu pagamento. Assim que for confirmado, você será redirecionado."}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <Link
          href="/"
          className="group relative inline-flex items-center justify-center px-8 py-3 overflow-hidden rounded-lg bg-[#E8DCC2] text-black text-lg font-medium tracking-wide transition-all"
        >
          <span className="absolute inset-0 bg-[#f3e9d4] scale-0 group-hover:scale-100 transition-transform duration-300 ease-out rounded-lg" />
          <span className="relative group-hover:text-black transition-colors">
            Voltar ao início
          </span>
        </Link>
      </motion.div>
    </main>
  );
}
