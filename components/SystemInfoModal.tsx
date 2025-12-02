"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface SystemInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SystemInfoModal({ open, onClose }: SystemInfoModalProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Fundo escuro */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Caixa do modal */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative bg-[#111] border border-[#ffffff18] rounded-2xl shadow-2xl 
                     w-[90%] max-w-lg p-8 text-[#E8DCC3]"
        >
          {/* Botão fechar */}
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
            onClick={onClose}
          >
            <X size={22} />
          </button>

          <h2 className="text-2xl font-semibold mb-3">
            Sobre o sistema
          </h2>

          <p className="text-gray-300 leading-relaxed mb-4">
            Esta plataforma foi desenvolvida pela <strong>Navira</strong>,
            trazendo tecnologia moderna, rapidez e design premium.
          </p>

          <ul className="text-gray-400 text-sm space-y-2 mb-6">
            <li>• Agendamento rápido e intuitivo</li>
            <li>• Carrinho inteligente para vários serviços</li>
            <li>• Notificações automáticas</li>
            <li>• Painel administrativo completo</li>
            <li>• Tecnologia Next.js + Supabase</li>
          </ul>

          <div className="flex justify-between items-center mt-4">
            <a
              href="https://navira.com.br"
              target="_blank"
              className="text-[#E8DCC3] font-semibold hover:underline"
            >
              Visitar Navira
            </a>

            <span className="text-xs text-gray-500">
              Sistema v1.0 — Navira
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
