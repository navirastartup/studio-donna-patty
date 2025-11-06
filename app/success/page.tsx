"use client";

import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="relative min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-center text-[#E8DCC2] px-6 overflow-hidden">
      {/* Glow de fundo (aura) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="w-80 h-80 rounded-full bg-green-500/10 blur-3xl animate-pulse"
        />
      </div>

      {/* Ícone principal */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 10 }}
        className="relative z-10 mb-6"
      >
        <CheckCircle className="w-20 h-20 text-[#7EE787] drop-shadow-[0_0_25px_rgba(126,231,135,0.4)]" />
      </motion.div>

      {/* Título e descrição */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="text-[2.2rem] md:text-4xl font-semibold tracking-tight mb-3"
      >
        Pagamento confirmado
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="text-gray-400 max-w-md mb-10 text-lg leading-relaxed"
      >
        Tudo certo com o seu agendamento.  
        Te esperamos no dia e horário marcados.
      </motion.p>

      {/* Botão com microanimação elegante */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <Link
          href="/agendamento"
          className="group relative inline-flex items-center justify-center px-8 py-3 overflow-hidden rounded-lg bg-[#E8DCC2] text-black text-lg font-medium tracking-wide transition-all"
        >
          <span className="absolute inset-0 bg-[#f3e9d4] scale-0 group-hover:scale-100 transition-transform duration-300 ease-out rounded-lg" />
          <span className="relative group-hover:text-black transition-colors">
            Voltar ao agendamento
          </span>
        </Link>
      </motion.div>
    </main>
  );
}
