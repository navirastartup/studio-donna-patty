"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "./NotificationsContext";
import clsx from "clsx";

export default function NotificationBell() {
  const { notifications, unreadCount, clearNotifications, markAllAsRead } =
    useNotifications();

  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  /* =========================================================
   * (1) Fechar popup ao clicar fora (com delay PRO)
   * ========================================================= */
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      // Não fecha ao clicar no sino
      if (bellRef.current?.contains(target)) return;

      // Não fecha ao clicar dentro do popup
      if (target?.closest(".notif-popup")) return;

      // Fecha o popup
      setOpen(false);
    }

    if (open) {
      // Delay pro popup existir no DOM
      timeout = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 50);
    }

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  /* =========================================================
   * (2) Animação do sino ao chegar notificação
   * ========================================================= */
  useEffect(() => {
    if (unreadCount > 0) {
      setAnimate(true);
      const timeout = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timeout);
    }
  }, [unreadCount]);

  /* =========================================================
   * (3) Ao abrir o popup → marcar todas como lidas (NÃO deleta)
   * ========================================================= */
  useEffect(() => {
    if (open && unreadCount > 0) {
      setTimeout(() => {
        markAllAsRead(); // NÃO APAGA, só marca
      }, 200);
    }
  }, [open]);

  /* =========================================================
   * (4) Agrupar notificações por tipo
   * ========================================================= */
  const grouped = notifications.reduce((acc: any, notif) => {
    if (!acc[notif.type]) acc[notif.type] = [];
    acc[notif.type].push(notif);
    return acc;
  }, {});

  return (
    <div className="relative">
      {/* BOTÃO DO SINO */}
      <button
        ref={bellRef}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 hover:bg-[#101826] transition-all",
          animate && "animate-[bellshake_0.6s_ease]"
        )}
      >
        <Bell className="w-5 h-5 text-gray-300" />

        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold 
                          text-white flex items-center justify-center border border-white shadow-md">
            {unreadCount}
          </div>
        )}
      </button>

      {/* POPUP */}
      {open && (
        <div
          className="notif-popup absolute right-0 mt-3 w-80 rounded-2xl bg-gray-900/90 backdrop-blur-xl 
                     border border-white/10 shadow-2xl animate-fadeIn p-4 z-50"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 font-semibold">Notificações</p>

            <button
              onClick={() => clearNotifications()}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Limpar tudo
            </button>
          </div>

          {notifications.length === 0 && (
            <p className="text-gray-500 text-sm">Nenhuma notificação</p>
          )}

          {Object.keys(grouped).map((type) => (
            <div key={type} className="mb-4 last:mb-0">
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
                {type === "agendamento" && "📅 Agendamentos"}
                {type === "estoque" && "📦 Estoque"}
                {type === "alerta" && "⚠️ Alertas"}
              </p>

              <div className="space-y-2">
                {grouped[type].map((notif: any) => (
                  <div
                    key={notif.id}
                    className="p-3 rounded-xl bg-gray-800/60 border border-gray-700 text-sm text-gray-200"
                  >
                    <p>{notif.message}</p>
                    <span className="text-[10px] text-gray-500">
                      {notif.date}
                    </span>
                  </div>
                ))}
              </div>

              <hr className="border-gray-700 mt-3" />
            </div>
          ))}
        </div>
      )}

      {/* ANIMAÇÃO */}
      <style>
        {`
        @keyframes bellshake {
          0% { transform: rotate(0); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
          75% { transform: rotate(8deg); }
          100% { transform: rotate(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        `}
      </style>
    </div>
  );
}
