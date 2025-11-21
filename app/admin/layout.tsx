"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Bell,
  User,
  ChevronDown,
  LayoutDashboard,
  ScissorsSquare,
  Users2,
  CalendarCheck2,
  Package,
  CreditCard,
  UserRound,
  Settings,
  LogOut,
} from "lucide-react";
import { LowStockProvider, useLowStock } from "./LowStockContext";
import { Toaster } from "sonner";
import  NotificationBell from "./NotificationBell";
import { NotificationsProvider } from "./NotificationsContext";



/* =========================================================
 * 🔹 Configuração do menu lateral
 * ========================================================= */
type NavItem = { href: string; label: string; icon: React.ReactNode };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/agendamentos", label: "Agendamentos", icon: <CalendarCheck2 className="w-4 h-4" /> },
  { href: "/admin/servicos", label: "Serviços", icon: <ScissorsSquare className="w-4 h-4" /> },
  { href: "/admin/profissionais", label: "Profissionais", icon: <Users2 className="w-4 h-4" /> },
  { href: "/admin/estoque", label: "Estoque", icon: <Package className="w-4 h-4" /> },
  { href: "/admin/financeiro", label: "Financeiro", icon: <CreditCard className="w-4 h-4" /> },
  { href: "/admin/clientes", label: "Clientes", icon: <UserRound className="w-4 h-4" /> },
  { href: "/admin/configuracoes", label: "Configurações", icon: <Settings className="w-4 h-4" /> },
];

/* =========================================================
 * 🔹 Sidebar
 * ========================================================= */
function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { lowStock, newAppointmentsCount } = useLowStock();
  const hasLowStock = lowStock.length > 0;

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-gray-900/95 border-r border-gray-800 rounded-tr-3xl rounded-br-3xl shadow-2xl">
      <div className="px-6 pt-6 pb-4">
        <div className="text-xl font-bold text-[#D6C6AA]">Studio Donna Patty</div>
        <div className="text-xs text-gray-400 mt-1">Admin</div>
      </div>

      <nav className="flex-1 px-3 mt-2 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : pathname.startsWith(item.href);

          const isEstoque = item.href === "/admin/estoque";
          const isAgendamento = item.href === "/admin/agendamentos";

          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition group",
                  active
                    ? "bg-[#111827] ring-1 ring-gray-800 text-white"
                    : "text-gray-300 hover:bg-[#0f172a] hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid place-items-center w-7 h-7 rounded-lg",
                    active ? "bg-[#1f2937]" : "bg-[#0f172a] group-hover:bg-[#111827]",
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span className="text-[14px] font-medium">{item.label}</span>
              </Link>

              {/* 🔴 Badge de estoque baixo */}
              {isEstoque && hasLowStock && (
                <div
                  className="absolute right-5 top-4 w-2.5 h-2.5 bg-red-500 rounded-full"
                  title={`${lowStock.length} produto${lowStock.length > 1 ? "s" : ""} com estoque baixo`}
                />
              )}

              {/* 🔴 Badge de novos agendamentos */}
              {isAgendamento && newAppointmentsCount > 0 && (
                <div
                  className="absolute right-4 top-3 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md animate-pulse"
                  title={`${newAppointmentsCount} novo${newAppointmentsCount > 1 ? "s" : ""} agendamento${newAppointmentsCount > 1 ? "s" : ""}`}
                >
                  {newAppointmentsCount > 9 ? "9+" : newAppointmentsCount}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-5">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
 * 🔹 Layout Principal com controle de som
 * ========================================================= */
function LayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { clearNewAppointments, soundEnabled, enableSound } = useLowStock();

  useEffect(() => {
    if (pathname === "/admin/agendamentos") {
      clearNewAppointments();
    }
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-2xl font-bold text-[#D6C6AA]">Painel Administrativo</div>
              <p className="text-sm text-gray-400">Gerencie seu estúdio em um só lugar</p>
            </div>

            {/* 🔊 Botão para ativar sons */}
            <div className="flex items-center gap-2">
              {!soundEnabled ? (
                <button
                  onClick={enableSound}
                  className="bg-[#D6C6AA] text-black font-medium px-3 py-2 rounded-lg hover:bg-[#cbbd9f] transition"
                >
                  🔔 Ativar sons
                </button>
              ) : (
                <button
                  disabled
                  className="bg-green-600 text-white font-medium px-3 py-2 rounded-lg cursor-default"
                >
                  ✅ Sons ativos
                </button>
              )}

              <NotificationBell />

              <button className="inline-flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-2 rounded-xl hover:bg-[#101826] transition">
                <User className="w-5 h-5 text-gray-300" />
                <span className="text-sm font-medium text-gray-200">Admin</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="mt-6 bg-gray-900/70 border border-gray-800 rounded-2xl shadow-xl">
            <div className="p-4 md:p-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
 * 🔹 Wrapper com Provider e autenticação
 * ========================================================= */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession ?? null);
      setLoading(false);
    }
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (!newSession) router.push("/login");
    });
    return () => authListener?.subscription.unsubscribe();
  }, [router]);

  if (loading)
    return (
      <div className="flex min-h-screen bg-gray-950 text-white items-center justify-center">
        <p className="text-[#D6C6AA] text-xl">Carregando Painel Administrativo...</p>
      </div>
    );

  if (!session) return null;

  return (
<NotificationsProvider>
  <LowStockProvider>
    <Toaster richColors position="top-center" offset={20} />
    <LayoutContent>{children}</LayoutContent>
  </LowStockProvider>
</NotificationsProvider>
  );
}
