// app/admin/financeiro/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  CalendarDays,
  TrendingUp,
  Plus,
  XCircle,
  Search,
  CreditCard,
  Banknote,
  BadgeCheck,
  ImageOff,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ============================================================
 * Tipos
 * ============================================================ */

type PaymentStatus = "approved" | "pending" | "failed" | string;
const statusLabels: Record<PaymentStatus, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  failed: "Falhou",
};


interface ClientRow {
  id: string;
  full_name: string | null;
  image_url?: string | null;
}

interface ProfessionalRow {
  id: string;
  name: string | null;
  image_url?: string | null;
}

interface ServiceRow {
  id: string;
  name: string | null;
  price: number | string | null;
}

interface AppointmentRow {
  id: string;
  client_id: string;
  professional_id: string | null;
  service_id: string | null;
  start_time: string;
  end_time: string;
  created_at: string | null;

  clients?: { full_name?: string | null; image_url?: string | null } | null;
  professionals?: { name?: string | null; image_url?: string | null } | null;
  services?: { name?: string | null; price?: number | string | null } | null;
}

interface PaymentRow {
  id: string;
  // vínculos
  invoice_id: string | null;
  appointment_id: string | null;

  // NOVOS campos (opcionais) para suportar pagamento manual com contexto
  client_id?: string | null;
  professional_id?: string | null;
  service_id?: string | null;

  // valores
  amount: number | string | null;
  method: string | null;
  status: PaymentStatus | null;
  payment_date: string; // ISO
  created_at: string | null;

  // joins por appointment (quando existir)
  appointments?: {
    id: string;
    clients?: { full_name?: string | null; image_url?: string | null } | null;
    professionals?: { name?: string | null; image_url?: string | null } | null;
    services?: { name?: string | null; price?: number | string | null } | null;
  } | null;

  // joins diretos por colunas opcionais de payments (quando pagamento for manual)
  clients?: { full_name?: string | null; image_url?: string | null } | null;
  professionals?: { name?: string | null; image_url?: string | null } | null;
  services?: { name?: string | null } | null;
}

/* ============================================================
 * Helpers
 * ============================================================ */

const toNumber = (v: number | string | null | undefined): number =>
  typeof v === "number" ? v : v ? Number(v) : 0;

const brl = (v: number | null | undefined) =>
  `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;

const safeDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const safeDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

const nowISO = () => new Date().toISOString();

const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

const startOfWeek = () => {
  const n = new Date();
  const day = n.getDay(); // 0 dom ... 6 sáb
  const offset = (day + 6) % 7; // semana começando na segunda
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - offset);
};

const startOfMonth = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
};

// Avatar simples (img com fallback em iniciais)
function Avatar({
  name,
  src,
  size = 26,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  const initials = (name || "—")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-gray-800 text-gray-300"
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
        title={name || ""}
      >
        {initials || <ImageOff className="w-4 h-4" />}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name || "avatar"}
      width={size}
      height={size}
      className="rounded-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = "";
      }}
      title={name || ""}
    />
  );
}

/* ============================================================
 * Página
 * ============================================================ */

export default function AdminFinanceiroPage() {
  // dados
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  type Range = "today" | "week" | "month" | "all";
  const [range, setRange] = useState<Range>("today");
  const [query, setQuery] = useState("");

  // modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    client_id: "",
    professional_id: "",
    service_id: "",
    method: "",
    amount: "",
    // opcional: vincular a um agendamento existente
    appointment_id: "",
  });

  /* ============================== Load inicial ============================== */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // payments + joins (appointment e joins diretos por client/professional/service opcionais)
        const { data: pays, error: payErr } = await supabase
          .from("payments")
          .select(`
            id, invoice_id, appointment_id, client_id, professional_id, service_id,
            amount, method, status, payment_date, created_at,

            appointments:appointment_id (
              id,
              clients ( full_name ),
              professionals ( name, image_url ),
              services ( name, price )
            ),

            clients:client_id ( full_name ),
            professionals:professional_id ( name, image_url ),
            services:service_id ( name )
          `)
          .order("payment_date", { ascending: false });

        if (payErr) throw payErr;

        const normalizedPays: PaymentRow[] = (pays ?? []).map((p: any) => ({
          ...p,
          appointments: (() => {
            const ap = Array.isArray(p?.appointments)
              ? p.appointments[0] ?? null
              : p?.appointments ?? null;
            if (ap && Array.isArray(ap.clients)) ap.clients = ap.clients[0] ?? null;
            if (ap && Array.isArray(ap.professionals)) ap.professionals = ap.professionals[0] ?? null;
            if (ap && Array.isArray(ap.services)) ap.services = ap.services[0] ?? null;
            return ap;
          })(),
          clients: Array.isArray(p?.clients) ? p.clients[0] ?? null : p?.clients ?? null,
          professionals: Array.isArray(p?.professionals) ? p.professionals[0] ?? null : p?.professionals ?? null,
          services: Array.isArray(p?.services) ? p.services[0] ?? null : p?.services ?? null,
        }));

        setPayments(normalizedPays);

        // appointments recentes (pra popular dropdown "vincular a agendamento")
        const { data: appts, error: apErr } = await supabase
          .from("appointments")
          .select(`
            id, client_id, professional_id, service_id, start_time, end_time, created_at,
            clients ( full_name ),
            professionals ( name, image_url ),
            services ( name, price )
          `)
          .order("start_time", { ascending: false })
          .limit(300);
        if (apErr) throw apErr;
        const normalizedAppts: AppointmentRow[] = (appts ?? []).map((ap: any) => ({
          ...ap,
          clients: Array.isArray(ap?.clients) ? ap.clients[0] ?? null : ap?.clients ?? null,
          professionals: Array.isArray(ap?.professionals) ? ap.professionals[0] ?? null : ap?.professionals ?? null,
          services: Array.isArray(ap?.services) ? ap.services[0] ?? null : ap?.services ?? null,
        }));
        setAppointments(normalizedAppts);

        // clients
        const { data: clis, error: cliErr } = await supabase
          .from("clients")
          .select("id, full_name")
          .order("full_name");
        if (cliErr) throw cliErr;
        setClients((clis ?? []) as ClientRow[]);

        // professionals
        const { data: profs, error: proErr } = await supabase
          .from("professionals")
          .select("id, name, image_url")
          .order("name");
        if (proErr) throw proErr;
        setProfessionals((profs ?? []) as ProfessionalRow[]);

        // services
        const { data: servs, error: srvErr } = await supabase
          .from("services")
          .select("id, name, price")
          .order("name");
        if (srvErr) throw srvErr;
        setServices((servs ?? []) as ServiceRow[]);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // pooling leve (atualiza pagamentos periodicamente)
  useEffect(() => {
    const id = setInterval(async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id, invoice_id, appointment_id, client_id, professional_id, service_id,
          amount, method, status, payment_date, created_at,

          appointments:appointment_id (
            id,
            clients ( full_name ),
            professionals ( name, image_url ),
            services ( name, price )
          ),

          clients:client_id ( full_name ),
          professionals:professional_id ( name, image_url ),
          services:service_id ( name )
        `)
        .order("payment_date", { ascending: false })
        .limit(300);

      if (!error) {
        const normalized = (data ?? []).map((p: any) => ({
          ...p,
          appointments: Array.isArray(p?.appointments) ? p.appointments[0] ?? null : p?.appointments ?? null,
          clients: Array.isArray(p?.clients) ? p.clients[0] ?? null : p?.clients ?? null,
          professionals: Array.isArray(p?.professionals) ? p.professionals[0] ?? null : p?.professionals ?? null,
          services: Array.isArray(p?.services) ? p.services[0] ?? null : p?.services ?? null,
        }));
        setPayments(normalized as PaymentRow[]);
      }
    }, 10_000);

    return () => clearInterval(id);
  }, []);

  /* ============================== Filtro + tabela unificada ============================== */

  type RowUI = {
    id: string;
    clientName: string;
    clientImage?: string | null;
    professionalName: string | null;
    professionalImage?: string | null;
    serviceName: string | null;
    method: string | null;
    amount: number;
    status: PaymentStatus;
    dateISO: string;
    origin: "appointment" | "manual";
  };

  const allRows: RowUI[] = useMemo(() => {
    const list: RowUI[] = [];

    for (const p of payments) {
      const byAppointment = !!p.appointment_id;

      // origem + nomes/imagens
      const origin: RowUI["origin"] = byAppointment ? "appointment" : "manual";

      const clientName = byAppointment
        ? p.appointments?.clients?.full_name ?? "—"
        : p.clients?.full_name ?? "—";
      const clientImage = byAppointment
        ? p.appointments?.clients?.image_url ?? null
        : p.clients?.image_url ?? null;

      const professionalName = byAppointment
        ? p.appointments?.professionals?.name ?? null
        : p.professionals?.name ?? null;
      const professionalImage = byAppointment
        ? p.appointments?.professionals?.image_url ?? null
        : p.professionals?.image_url ?? null;

      const serviceName = byAppointment
        ? p.appointments?.services?.name ?? null
        : p.services?.name ?? null;

      list.push({
        id: p.id,
        clientName,
        clientImage,
        professionalName,
        professionalImage,
        serviceName,
        method: p.method ?? "—",
        amount: toNumber(p.amount),
        status: (p.status?.toLowerCase() ?? "approved") as PaymentStatus,
        dateISO: p.payment_date,
        origin,
      });
    }

    // ordena por data desc
    return list.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
  }, [payments]);

  const filteredRows: RowUI[] = useMemo(() => {
    const start =
      range === "today"
        ? startOfToday()
        : range === "week"
        ? startOfWeek()
        : range === "month"
        ? startOfMonth()
        : new Date(0);

    const q = query.trim().toLowerCase();

    return allRows.filter((r) => {
      const inRange = new Date(r.dateISO) >= start;
      const matches =
        !q ||
        r.clientName.toLowerCase().includes(q) ||
        (r.professionalName ?? "").toLowerCase().includes(q) ||
        (r.serviceName ?? "").toLowerCase().includes(q) ||
        (r.method ?? "").toLowerCase().includes(q);
      return inRange && matches;
    });
  }, [allRows, range, query]);

  /* ============================== Métricas ============================== */

  const { revenueToday, revenueWeek, revenueMonth } = useMemo(() => {
    const startT = startOfToday();
    const startW = startOfWeek();
    const startM = startOfMonth();

    const sum = (from: Date) =>
      allRows
        .filter((r) => r.status === "approved" && new Date(r.dateISO) >= from)
        .reduce((s, r) => s + r.amount, 0);

    return {
      revenueToday: sum(startT),
      revenueWeek: sum(startW),
      revenueMonth: sum(startM),
    };
  }, [allRows]);

    const generatePDF = () => {
      const doc = new jsPDF("p", "pt");
    
      // ✅ aplicar o plugin manualmente
      autoTable(doc, {
        startY: 80,
        head: [["Cliente", "Profissional", "Serviço", "Método", "Valor", "Status", "Data"]],
        body: allRows.map((r) => [
          r.clientName,
          r.professionalName,
          r.serviceName,
          r.method,
          brl(r.amount),
          r.status,
          safeDateTime(r.dateISO),
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [230, 200, 150], textColor: 20, halign: "center" },
      });
    
      doc.save(`relatorio-financeiro-${Date.now()}.pdf`);
    };
    

  
  /* ============================== Modal: Registrar Pagamento ============================== */

  const openPaymentModal = () => {
    setPaymentForm({
      client_id: "",
      professional_id: "",
      service_id: "",
      method: "",
      amount: "",
      appointment_id: "",
    });
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
  };

  const onPaymentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPaymentForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // se usuário escolheu vincular a um agendamento, usa appointment_id (e ignora os IDs diretos)
      const isLinkedToAppointment = !!paymentForm.appointment_id;

      const payload: Record<string, any> = {
        appointment_id: isLinkedToAppointment ? paymentForm.appointment_id : null,
        invoice_id: null,
        amount: toNumber(paymentForm.amount),
        method: paymentForm.method || "Outro",
        status: "approved" as PaymentStatus,
        payment_date: nowISO(),
        created_at: nowISO(),
      };

      // se NÃO estiver vinculado a agendamento, gravamos client/professional/service na própria payments
      if (!isLinkedToAppointment) {
        payload.client_id = paymentForm.client_id || null;
        payload.professional_id = paymentForm.professional_id || null;
        payload.service_id = paymentForm.service_id || null;
      }

      const { error } = await supabase.from("payments").insert([payload]);
      if (error) throw error;

      // recarrega lista
      const { data: pays2, error: payErr2 } = await supabase
      .from("payments")
      .select(`
        id, invoice_id, appointment_id, client_id, professional_id, service_id,
        amount, method, status, payment_date, created_at,
    
        appointments:appointment_id (
          id,
          clients ( full_name ),
          professionals ( name, image_url ),
          services ( name, price )
        ),
    
        clients:client_id ( full_name ),
        professionals:professional_id ( name, image_url ),
        services:service_id ( name )
      `)
      .order("payment_date", { ascending: false });
    

      const normalized: PaymentRow[] = (pays2 ?? []).map((p: any) => ({
        ...p,
        appointments: Array.isArray(p?.appointments) ? p.appointments[0] ?? null : p?.appointments ?? null,
        clients: Array.isArray(p?.clients) ? p.clients[0] ?? null : p?.clients ?? null,
        professionals: Array.isArray(p?.professionals) ? p.professionals[0] ?? null : p?.professionals ?? null,
        services: Array.isArray(p?.services) ? p.services[0] ?? null : p?.services ?? null,
      }));
      setPayments(normalized);

      setIsPaymentModalOpen(false);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? String(e));
    }
  };

  /* ============================== UI ============================== */

  if (loading) return <p className="text-[#D6C6AA] p-6">Carregando financeiro...</p>;
  if (error) return <p className="text-red-500 p-6">Erro: {error}</p>;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
{/* Header */}
<div className="flex items-center justify-between">
  <h2 className="text-3xl font-bold text-[#D6C6AA]">Financeiro</h2>

  <div className="flex gap-2">
    <button
      onClick={generatePDF}
      className="inline-flex items-center gap-2 bg-gray-800 text-[#D6C6AA] px-4 py-2 rounded-lg hover:bg-gray-700"
    >
      <CreditCard className="w-4 h-4" />
      Gerar PDF
    </button>

    <button
      onClick={openPaymentModal}
      className="inline-flex items-center gap-2 bg-[#D6C6AA] text-black px-4 py-2 rounded-lg hover:opacity-90"
    >
      <Plus className="w-5 h-5" />
      Registrar Pagamento
    </button>
  </div>
</div>


      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Wallet className="w-4 h-4" />
            <span>Total Hoje</span>
          </div>
          <div className="text-2xl font-bold">{brl(revenueToday)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <CalendarDays className="w-4 h-4" />
            <span>Total da Semana</span>
          </div>
          <div className="text-2xl font-bold">{brl(revenueWeek)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span>Faturado do Mês</span>
          </div>
          <div className="text-2xl font-bold">{brl(revenueMonth)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <button
            onClick={() => setRange("today")}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              range === "today" ? "bg-[#D6C6AA] text-black" : "bg-gray-900"
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setRange("week")}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              range === "week" ? "bg-[#D6C6AA] text-black" : "bg-gray-900"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setRange("month")}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              range === "month" ? "bg-[#D6C6AA] text-black" : "bg-gray-900"
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => setRange("all")}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              range === "all" ? "bg-[#D6C6AA] text-black" : "bg-gray-900"
            }`}
          >
            Tudo
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, serviço, profissional ou método"
            className="pl-9 pr-3 py-2 rounded-lg bg-gray-900 text-sm w-[320px]"
          />
        </div>
      </div>

      {/* Tabela de Movimentações */}
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-lg">Movimentações</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-6 py-3 text-left">Origem</th>
                <th className="px-6 py-3 text-left">Cliente</th>
                <th className="px-6 py-3 text-left">Profissional</th>
                <th className="px-6 py-3 text-left">Serviço</th>
                <th className="px-6 py-3 text-left">Método</th>
                <th className="px-6 py-3 text-left">Valor</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((r) => {
                const normalizedStatus = (r.status ?? "").toString().toLowerCase();

                const isApproved =
                  normalizedStatus === "approved" ||
                  normalizedStatus === "aprovado" ||
                  normalizedStatus === "paid";

                const isPending =
                  normalizedStatus === "pending" ||
                  normalizedStatus === "pendente" ||
                  normalizedStatus === "aguardando";

                const badge = isApproved
                  ? "bg-green-700/60 text-green-100"
                  : isPending
                  ? "bg-yellow-700/60 text-yellow-100"
                  : "bg-red-700/60 text-red-100";

                const label = isApproved
                  ? "Aprovado"
                  : isPending
                  ? "Pendente"
                  : "Falhou";

                return (
                  <tr key={r.id} className="border-t border-gray-800">
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-300">
                        {r.origin === "appointment" ? (
                          <BadgeCheck className="w-4 h-4" />
                        ) : (
                          <Banknote className="w-4 h-4" />
                        )}
                        {r.origin === "appointment" ? "Agendamento" : "Manual"}
                      </span>
                    </td>

                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.clientName} src={r.clientImage} />
                        <span>{r.clientName}</span>
                      </div>
                    </td>

                    <td className="px-6 py-3">
                      {r.professionalName ? (
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={r.professionalName}
                            src={r.professionalImage}
                          />
                          <span>{r.professionalName}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-6 py-3">{r.serviceName ?? "—"}</td>

                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        {r.method ?? "—"}
                      </span>
                    </td>

                    <td className="px-6 py-3">{brl(r.amount)}</td>

                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${badge}`}
                      >
                        {label}
                      </span>
                    </td>

                    <td className="px-6 py-3">{safeDateTime(r.dateISO)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Registrar Pagamento</h4>
              <button onClick={closePaymentModal} className="text-gray-400 hover:text-gray-200">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={savePayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Cliente</label>
                  <select
                    name="client_id"
                    value={paymentForm.client_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2"
                    required={!paymentForm.appointment_id}
                    disabled={!!paymentForm.appointment_id}
                  >
                    <option value="">Selecione</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name ?? "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Vincular a Agendamento (opcional)
                  </label>
                  <select
                    name="appointment_id"
                    value={paymentForm.appointment_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2"
                  >
                    <option value="">—</option>
                    {appointments.slice(0, 100).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.clients?.full_name ?? "Sem cliente"} • {a.services?.name ?? "sem serviço"} •{" "}
                        {safeDate(a.start_time)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Profissional (opcional)
                  </label>
                  <select
                    name="professional_id"
                    value={paymentForm.professional_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2"
                    disabled={!!paymentForm.appointment_id}
                  >
                    <option value="">—</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name ?? "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Serviço (opcional)</label>
                  <select
                    name="service_id"
                    value={paymentForm.service_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2"
                    disabled={!!paymentForm.appointment_id}
                  >
                    <option value="">—</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={paymentForm.amount}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Método</label>
                  <select
                    name="method"
                    value={paymentForm.method}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2"
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closePaymentModal} className="px-4 py-2 rounded-lg bg-gray-800">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#D6C6AA] text-black font-medium">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
