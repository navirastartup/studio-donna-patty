"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  CalendarClock,
  CheckCircle2,
  Users,
  Scissors,
  CreditCard,
  Clock3,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

/* ============================================================
 * Utils
 * ============================================================ */
const BRL = (v: number) =>
  `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

const ptWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthShortPt = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

// ajuda a normalizar resultados de joins do Supabase (array | obj | null)
const pickFirst = <T,>(x: T | T[] | null | undefined): T | null =>
  Array.isArray(x) ? (x[0] ?? null) : (x ?? null);

/* ============================================================
 * Tipos
 * ============================================================ */
type ApptStatus = "pendente" | "confirmado" | "cancelado" | "concluido" | string;

type AppointmentRow = {
  id: string;
  start_time: string;
  status: ApptStatus;
  clients?: { full_name?: string | null }[] | { full_name?: string | null } | null;
  professionals?:
    | { name?: string | null; image_url?: string | null }[]
    | { name?: string | null; image_url?: string | null }
    | null;
  services?: { name?: string | null }[] | { name?: string | null } | null;
};

type PaymentRow = { amount: number | string | null; created_at: string };

/* ============================================================
 * Página
 * ============================================================ */
export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    pendentes: 0,
    confirmados: 0,
    clientes: 0,
    servicos: 0,
    recebido: 0,
    pendenteValor: 0,
  });

  const [lastAppointments, setLastAppointments] = useState<
    {
      id: string;
      time: string;
      cliente: string;
      servico: string;
      prof: string;
      status: ApptStatus;
    }[]
  >([]);

  const [bookingsChart, setBookingsChart] = useState<
    { name: string; total: number }[]
  >([]);

  const [revenueChart, setRevenueChart] = useState<
    { name: string; total: number }[]
  >([]);

  const [ranking, setRanking] = useState<
    { id: string; name: string; image_url?: string | null; total: number }[]
  >([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        /* ========== KPIs base (contagens) ========== */
        const [
          pendQ,
          confQ,
          clientsQ,
          servicesQ,
          apptsQ,
          paymentsQ,
          pendingValueQ,
          rankQ,
        ] = await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("status", "pendente"),
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("status", "confirmado"),
          supabase.from("clients").select("id", { count: "exact", head: true }),
          supabase.from("services").select("id", { count: "exact", head: true }),

          // últimos 8 agendamentos (com joins)
          supabase
            .from("appointments")
            .select(
              `
              id,
              start_time,
              status,
              clients:client_id(full_name),
              professionals:professional_id(name, image_url),
              services:service_id(name)
            `
            )
            .order("start_time", { ascending: false })
            .limit(8),

          // todos pagamentos para gráficos (poderia filtrar por período)
          supabase.from("payments").select("amount, created_at"),

          // “valor pendente” — some amount de invoices/payments pendentes se você tiver essa coluna.
          // fallback: 0
          supabase
            .from("payments")
            .select("amount, status")
            .eq("status", "pending"),

          // ranking de profissionais: contar agendamentos confirmados/concluídos
          supabase
            .from("appointments")
            .select("professional_id, status, professionals:professional_id(name, image_url)")
            .in("status", ["confirmado", "concluido"]),
        ]);

        const pendentes = pendQ.count || 0;
        const confirmados = confQ.count || 0;
        const clientes = clientsQ.count || 0;
        const servicos = servicesQ.count || 0;

        /* ========== Últimos agendamentos ========== */
        const appts = (apptsQ.data || []) as AppointmentRow[];
        const last = appts.map((a) => {
          const c = pickFirst(a.clients)?.full_name ?? "—";
          const s = pickFirst(a.services)?.name ?? "—";
          const p = pickFirst(a.professionals)?.name ?? "—";
          return {
            id: a.id,
            time: new Date(a.start_time).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }),
            cliente: c || "—",
            servico: s || "—",
            prof: p || "—",
            status: a.status,
          };
        });
        setLastAppointments(last);

        /* ========== Total recebido e valor pendente ========== */
        const pays = (paymentsQ.data || []) as PaymentRow[];
        const totalRecebido = pays.reduce(
          (s, p) => s + Number(p.amount || 0),
          0
        );

        const pendingPays = (pendingValueQ.data || []) as {
          amount: number | string | null;
          status: string | null;
        }[];
        const pendenteValor = pendingPays.reduce(
          (s, r) => s + Number(r.amount || 0),
          0
        );

        setStats({
          pendentes,
          confirmados,
          clientes,
          servicos,
          recebido: totalRecebido,
          pendenteValor,
        });

        /* ========== Gráfico: agendamentos por dia (semana atual) ========== */
        const weekBuckets = Array(7).fill(0) as number[];
        for (const a of appts) {
          const d = new Date(a.start_time);
          weekBuckets[d.getDay()]++;
        }
        setBookingsChart(
          ptWeek.map((name, i) => ({ name, total: weekBuckets[i] }))
        );

        /* ========== Gráfico: Receita mensal (dos payments) ========== */
        const monthMap: Record<string, number> = {};
        for (const p of pays) {
          const d = new Date(p.created_at);
          const k = monthShortPt(d);
          monthMap[k] = (monthMap[k] || 0) + Number(p.amount || 0);
        }
        const rev = Object.entries(monthMap).map(([name, total]) => ({
          name,
          total,
        }));
        setRevenueChart(rev);

        /* ========== Ranking de profissionais ========== */
        const rankRaw =
          (rankQ.data as {
            professional_id: string | null;
            status: string | null;
            professionals:
              | { name?: string | null; image_url?: string | null }[]
              | { name?: string | null; image_url?: string | null }
              | null;
          }[]) || [];

        const bucket: Record<
          string,
          { id: string; name: string; image_url?: string | null; total: number }
        > = {};

        for (const r of rankRaw) {
          const pid = r.professional_id || "_";
          const p = pickFirst(r.professionals);
          if (!bucket[pid]) {
            bucket[pid] = {
              id: pid,
              name: p?.name ?? "—",
              image_url: p?.image_url ?? null,
              total: 0,
            };
          }
          bucket[pid].total++;
        }

        const rankList = Object.values(bucket)
          .sort((a, b) => b.total - a.total)
          .slice(0, 6);
        setRanking(rankList);
      } catch (err) {
        console.error("Erro ao montar dashboard:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = useMemo(() => {
    const n = new Date();
    return n.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D6C6AA] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="p-6 space-y-8">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-[#D6C6AA]">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Resumo • {today}</p>
      </div>

      {/* Logo carregada do Supabase */}
      <LogoStudio />
    </div>

    {/* KPIs */}
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Kpi
          title="Pendentes"
          value={stats.pendentes}
          icon={<CalendarClock className="w-5 h-5" />}
          accent="text-yellow-400"
          border="border-yellow-700/40"
        />
        <Kpi
          title="Confirmados"
          value={stats.confirmados}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="text-green-400"
          border="border-green-700/40"
        />
        <Kpi
          title="Clientes"
          value={stats.clientes}
          icon={<Users className="w-5 h-5" />}
          accent="text-blue-400"
          border="border-blue-700/40"
        />
        <Kpi
          title="Serviços"
          value={stats.servicos}
          icon={<Scissors className="w-5 h-5" />}
          accent="text-purple-400"
          border="border-purple-700/40"
        />
        <KpiMoney
          title="Total Recebido"
          value={BRL(stats.recebido)}
          icon={<CreditCard className="w-5 h-5" />}
          accent="text-emerald-400"
          border="border-emerald-700/40"
        />
        <KpiMoney
          title="Pendentes (R$)"
          value={BRL(stats.pendenteValor)}
          icon={<Clock3 className="w-5 h-5" />}
          accent="text-yellow-400"
          border="border-yellow-700/40"
        />
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[#D6C6AA] font-semibold">
              Agendamentos por Dia
            </h3>
            <TrendingUp className="w-4 h-4 text-[#D6C6AA]" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bookingsChart}>
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#E5E7EB" }} />
              <Bar dataKey="total" fill="#D6C6AA" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[#D6C6AA] font-semibold">Receita Mensal</h3>
            <CreditCard className="w-4 h-4 text-[#D6C6AA]" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#E5E7EB" }} />
              <Line type="monotone" dataKey="total" stroke="#D6C6AA" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Últimos agendamentos + Ranking */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tabela */}
        <div className="xl:col-span-2 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-[#D6C6AA] font-semibold">Últimos Agendamentos</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Serviço</th>
                <th className="px-5 py-3 text-left">Profissional</th>
                <th className="px-5 py-3 text-left">Data / Hora</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {lastAppointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-800/70 transition">
                  <td className="px-5 py-3">{a.cliente}</td>
                  <td className="px-5 py-3">{a.servico}</td>
                  <td className="px-5 py-3">{a.prof}</td>
                  <td className="px-5 py-3 text-gray-400">{a.time}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
              {lastAppointments.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-gray-500" colSpan={5}>
                    Sem agendamentos ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ranking */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-[#D6C6AA] font-semibold mb-4">
            🏆 Ranking de Profissionais
          </h3>
          <div className="space-y-4">
            {ranking.map((r, idx) => (
              <div
                key={r.id + idx}
                className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-gray-800"
              >
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-800">
                  {r.image_url ? (
                    <Image
                      src={r.image_url}
                      alt={r.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-gray-500 text-xs">
                      sem foto
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-200 font-medium">{r.name}</span>
                    <span className="text-[#D6C6AA] font-semibold">
                      {r.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded mt-2">
                    <div
                      className="h-2 rounded bg-[#D6C6AA]"
                      style={{
                        width: `${Math.min(100, (r.total / (ranking[0]?.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {ranking.length === 0 && (
              <p className="text-gray-500 text-sm">Sem dados de ranking.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ============================================================
 * Componentes
 * ============================================================ */

function LogoStudio() {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogo() {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .eq("key", "system_logo_url")
        .single();

      if (!error && data?.value) {
        setLogo(data.value);
      } else {
        console.warn("Nenhuma logo encontrada em settings (system_logo_url).");
      }
    }
    loadLogo();
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-800 ring-1 ring-[#D6C6AA]/30">
        {logo ? (
          <Image
            src={logo}
            alt="Logo do estúdio"
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-500 text-xs">
            sem logo
          </div>
        )}
      </div>
      <span className="text-sm text-gray-300">Studio Donna Patty</span>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
  accent,
  border,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string; // ex: text-green-400
  border: string; // ex: border-green-700/40
}) {
  return (
    <div className={`bg-gray-900 rounded-xl p-4 border ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        <span className={`${accent}`}>{icon}</span>
      </div>
      <div className={`text-4xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function KpiMoney({
  title,
  value,
  icon,
  accent,
  border,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  border: string;
}) {
  return (
    <div className={`bg-gray-900 rounded-xl p-4 border ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        <span className={`${accent}`}>{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ApptStatus }) {
  const s = String(status).toLowerCase();
  const map =
    s === "confirmado"
      ? "bg-green-700/30 text-green-300"
      : s === "pendente"
      ? "bg-yellow-700/30 text-yellow-300"
      : s === "concluido"
      ? "bg-blue-700/30 text-blue-300"
      : s === "cancelado"
      ? "bg-red-700/30 text-red-300"
      : "bg-gray-700/30 text-gray-300";
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map}`}>
      {s}
    </span>
  );
}
