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
  AlertTriangle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PaymentDetailsModal from "@/components/modals/PaymentDetailsModal";
import type { RowUI } from "@/src/types/RowUI";

/* ============================================================
 * Tipos
 * ============================================================ */

type PaymentStatus = "approved" | "pending" | "failed" | string;

const statusLabels: Record<string, string> = {
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
  invoice_id: string | null;
  appointment_id: string | null;

  client_id?: string | null;
  professional_id?: string | null;
  service_id?: string | null;

  amount: number | string | null;
  method: string | null;
  status: PaymentStatus | null;
  payment_date: string; // ISO
  created_at: string | null;

  appointments?: {
    id: string;
    clients?: { full_name?: string | null; image_url?: string | null } | null;
    professionals?: { name?: string | null; image_url?: string | null } | null;
    services?: { name?: string | null; price?: number | string | null } | null;
  } | null;

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

const normalizeStatus = (s: PaymentStatus | null | undefined) =>
  s?.toString().toLowerCase() ?? "";

const isApprovedStatus = (s: PaymentStatus | null | undefined) => {
  const n = normalizeStatus(s);
  return n === "approved" || n === "aprovado" || n === "paid";
};

const isPendingStatus = (s: PaymentStatus | null | undefined) => {
  const n = normalizeStatus(s);
  return n === "pending" || n === "pendente" || n === "aguardando";
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

  // modal detalhes de pagamentos
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
    appointment_id: "",
  });

  
  /* ============================== Load inicial ============================== */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: pays, error: payErr } = await supabase
          .from("payments")
          .select(`
            id, invoice_id, appointment_id, client_id, professional_id, service_id,
            amount, method, status, payment_date, created_at,

appointments:appointment_id (
  id,
  start_time,
  end_time,
  clients ( full_name),
  professionals ( name, image_url ),
  services ( name, price )
),


            clients:client_id ( full_name),
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
            if (ap && Array.isArray(ap.professionals))
              ap.professionals = ap.professionals[0] ?? null;
            if (ap && Array.isArray(ap.services))
              ap.services = ap.services[0] ?? null;
            return ap;
          })(),
          clients: Array.isArray(p?.clients) ? p.clients[0] ?? null : p?.clients ?? null,
          professionals: Array.isArray(p?.professionals)
            ? p.professionals[0] ?? null
            : p?.professionals ?? null,
          services: Array.isArray(p?.services) ? p.services[0] ?? null : p?.services ?? null,
        }));

        setPayments(normalizedPays);

        const { data: appts, error: apErr } = await supabase
          .from("appointments")
          .select(`
            id, client_id, professional_id, service_id, start_time, end_time, created_at,
            clients ( full_name),
            professionals ( name, image_url ),
            services ( name, price )
          `)
          .order("start_time", { ascending: false })
          .limit(300);

        if (apErr) throw apErr;

        const normalizedAppts: AppointmentRow[] = (appts ?? []).map((ap: any) => ({
          ...ap,
          clients: Array.isArray(ap?.clients) ? ap.clients[0] ?? null : ap?.clients ?? null,
          professionals: Array.isArray(ap?.professionals)
            ? ap.professionals[0] ?? null
            : ap?.professionals ?? null,
          services: Array.isArray(ap?.services) ? ap.services[0] ?? null : ap?.services ?? null,
        }));
        setAppointments(normalizedAppts);

        const { data: clis, error: cliErr } = await supabase
          .from("clients")
          .select("id, full_name")
          .order("full_name");
        if (cliErr) throw cliErr;
        setClients((clis ?? []) as ClientRow[]);

        const { data: profs, error: proErr } = await supabase
          .from("professionals")
          .select("id, name, image_url")
          .order("name");
        if (proErr) throw proErr;
        setProfessionals((profs ?? []) as ProfessionalRow[]);

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

  // polling leve
  useEffect(() => {
    const id = setInterval(async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id, invoice_id, appointment_id, client_id, professional_id, service_id,
          amount, method, status, payment_date, created_at,

appointments:appointment_id (
  id,
  start_time,
  end_time,
  clients ( full_name),
  professionals ( name, image_url ),
  services ( name, price )
),


          clients:client_id ( full_name),
          professionals:professional_id ( name, image_url ),
          services:service_id ( name )
        `)
        .order("payment_date", { ascending: false })
        .limit(300);

      if (!error) {
        const normalized = (data ?? []).map((p: any) => ({
          ...p,
          appointments: Array.isArray(p?.appointments)
            ? p.appointments[0] ?? null
            : p?.appointments ?? null,
          clients: Array.isArray(p?.clients) ? p.clients[0] ?? null : p?.clients ?? null,
          professionals: Array.isArray(p?.professionals)
            ? p.professionals[0] ?? null
            : p?.professionals ?? null,
          services: Array.isArray(p?.services) ? p.services[0] ?? null : p?.services ?? null,
        }));
        setPayments(normalized as PaymentRow[]);
      }
    }, 10_000);

    return () => clearInterval(id);
  }, []);

  /* ============================== Filtro + tabela unificada ============================== */


  const allRows: RowUI[] = useMemo(() => {
    const list: RowUI[] = [];

    for (const p of payments) {
      const byAppointment = !!p.appointment_id;

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
  status: p.status ? p.status.toString().toLowerCase() : "pending",
  dateISO: p.payment_date,
  origin,
  appointmentStart: byAppointment ? (p.appointments as any)?.start_time ?? null : null,
  appointmentEnd: byAppointment ? (p.appointments as any)?.end_time ?? null : null,
});

    }

    return list.sort(
      (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );
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

  const {
    revenueToday,
    revenueWeek,
    revenueMonth,
    totalRevenue,
    totalPayments,
    uniqueClients,
    averageTicket,
  } = useMemo(() => {
    const startT = startOfToday();
    const startW = startOfWeek();
    const startM = startOfMonth();

    const approved = allRows.filter((r) => isApprovedStatus(r.status));

    const sumFrom = (from: Date) =>
      approved
        .filter((r) => new Date(r.dateISO) >= from)
        .reduce((s, r) => s + r.amount, 0);

    const totalRevenueCalc = approved.reduce((s, r) => s + r.amount, 0);
    const totalPaymentsCalc = approved.length;

    const uniqueClientsSet = new Set(
      approved.map((r) => (r.clientName || "").toLowerCase())
    );

    const avgTicket =
      totalPaymentsCalc > 0 ? totalRevenueCalc / totalPaymentsCalc : 0;

    return {
      revenueToday: sumFrom(startT),
      revenueWeek: sumFrom(startW),
      revenueMonth: sumFrom(startM),
      totalRevenue: totalRevenueCalc,
      totalPayments: totalPaymentsCalc,
      uniqueClients: uniqueClientsSet.size,
      averageTicket: avgTicket,
    };
  }, [allRows]);

  /* ============================== Distribuição por método ============================== */

  const methodDistribution = useMemo(() => {
    const approved = allRows.filter((r) => isApprovedStatus(r.status));
    const totalsByMethod: Record<string, number> = {};

    approved.forEach((r) => {
      const key = r.method || "Outro";
      totalsByMethod[key] = (totalsByMethod[key] ?? 0) + r.amount;
    });

    const total = Object.values(totalsByMethod).reduce((s, v) => s + v, 0);

    return Object.entries(totalsByMethod)
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allRows]);

  /* ============================== Faturamento por profissional ============================== */

  const revenueByProfessional = useMemo(() => {
    const approved = allRows.filter((r) => isApprovedStatus(r.status));
    const map: Record<string, number> = {};

    approved.forEach((r) => {
      const key = r.professionalName || "Sem profissional";
      map[key] = (map[key] ?? 0) + r.amount;
    });

    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [allRows]);

  /* ============================== Pagamentos pendentes ============================== */

  const pendingRows: RowUI[] = useMemo(
    () => allRows.filter((r) => isPendingStatus(r.status)),
    [allRows]
  );

  /* ============================== PDF ============================== */

  const generatePDF = () => {
    const doc = new jsPDF("p", "pt");

    autoTable(doc, {
      startY: 80,
      head: [
        ["Cliente", "Profissional", "Serviço", "Método", "Valor", "Status", "Data"],
      ],
      body: allRows.map((r) => [
        r.clientName,
        r.professionalName,
        r.serviceName,
        r.method,
        brl(r.amount),
        statusLabels[normalizeStatus(r.status)] ?? r.status,
        safeDateTime(r.dateISO),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [230, 200, 150], textColor: 20, halign: "center" },
    });

    doc.save(`relatorio-financeiro-${Date.now()}.pdf`);
  };

  /* ============================== Ações (modal / marcar como pago) ============================== */

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

  const onPaymentChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setPaymentForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const refreshPayments = async () => {
    const { data: pays2 } = await supabase
      .from("payments")
      .select(`
        id, invoice_id, appointment_id, client_id, professional_id, service_id,
        amount, method, status, payment_date, created_at,

appointments:appointment_id (
  id,
  start_time,
  end_time,
  clients ( full_name),
  professionals ( name, image_url ),
  services ( name, price )
),


        clients:client_id ( full_name),
        professionals:professional_id ( name, image_url ),
        services:service_id ( name )
      `)
      .order("payment_date", { ascending: false });

    const normalized: PaymentRow[] = (pays2 ?? []).map((p: any) => ({
      ...p,
      appointments: Array.isArray(p?.appointments)
        ? p.appointments[0] ?? null
        : p?.appointments ?? null,
      clients: Array.isArray(p?.clients) ? p.clients[0] ?? null : p?.clients ?? null,
      professionals: Array.isArray(p?.professionals)
        ? p.professionals[0] ?? null
        : p?.professionals ?? null,
      services: Array.isArray(p?.services) ? p.services[0] ?? null : p?.services ?? null,
    }));
    setPayments(normalized);
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
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

      if (!isLinkedToAppointment) {
        payload.client_id = paymentForm.client_id || null;
        payload.professional_id = paymentForm.professional_id || null;
        payload.service_id = paymentForm.service_id || null;
      }

      const { error } = await supabase.from("payments").insert([payload]);
      if (error) throw error;

      await refreshPayments();
      setIsPaymentModalOpen(false);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? String(e));
    }
  };

const markPaymentAsApproved = async (paymentId: string) => {
  try {
    setError(null);

    const res = await fetch("/api/admin/payments/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: paymentId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Erro ao marcar como pago");
    }

    await refreshPayments();
  } catch (e: any) {
    console.error(e);
    setError(e.message ?? String(e));
  }
};

const handleEditPayment = async (updated: RowUI) => {
  try {
    setError(null);

const res = await fetch("/api/admin/payments/update", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: updated.id,
    amount: updated.amount,
    method: updated.method,
    status: updated.status
  })
});

const data = await res.json();
if (!res.ok) throw new Error(data.error);


    if (error) throw error;

    await refreshPayments();
  } catch (e: any) {
    console.error(e);
    setError(e.message ?? String(e));
  }
};


const handleCancelPayment = async (paymentId: string) => {
  try {
    const res = await fetch("/api/admin/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: paymentId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    await refreshPayments();
  } catch (e: any) {
    console.error(e);
    setError(e.message ?? String(e));
  }
};


const handleDeletePayment = async (paymentId: string) => {
  try {
    const res = await fetch("/api/admin/payments/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: paymentId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    await refreshPayments();
  } catch (e: any) {
    console.error(e);
    setError(e.message ?? String(e));
  }
};


// se quiser lidar com estorno depois:
const handleRefundPayment = async (paymentId: string) => {
  console.log("REFUND (a implementar):", paymentId);
};

  /* ============================== UI ============================== */

  if (loading) return <p className="text-[#D6C6AA] p-6">Carregando financeiro...</p>;
  if (error) return <p className="text-red-500 p-6">Erro: {error}</p>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#D6C6AA]">Financeiro</h2>
          <p className="text-sm text-gray-400 mt-1">
            Visão geral do faturamento, pendências e movimentações do estúdio.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente, serviço, profissional ou método"
              className="pl-9 pr-3 py-2 rounded-lg bg-gray-900 text-sm w-[260px]"
            />
          </div>

          <button
            onClick={generatePDF}
            className="inline-flex items-center gap-2 bg-gray-800 text-[#D6C6AA] px-4 py-2 rounded-lg hover:bg-gray-700 text-sm"
          >
            <CreditCard className="w-4 h-4" />
            Gerar PDF
          </button>

          <button
            onClick={openPaymentModal}
            className="inline-flex items-center gap-2 bg-[#D6C6AA] text-black px-4 py-2 rounded-lg hover:opacity-90 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Registrar pagamento
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
        {/* Card premium saldo + métricas rápidas */}
        <div className="2xl:col-span-6 space-y-4">
          {/* Card premium de saldo do mês */}
          <div className="rounded-2xl bg-gradient-to-br from-black via-gray-900 to-gray-950 p-6 border border-gray-800 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-[0.25em] uppercase text-gray-400">
                  Saldo do mês
                </p>
                <p className="mt-2 text-4xl font-bold text-[#D6C6AA]">
                  {brl(revenueMonth)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Somente pagamentos <span className="font-semibold">aprovados</span>{" "}
                  registrados neste mês.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
                <span>Total acumulado</span>
                <span className="text-base font-semibold text-[#D6C6AA]">
                  {brl(totalRevenue)}
                </span>
              </div>
            </div>

            {/* mini infos embaixo */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-gray-900/70 px-3 py-2 flex flex-col gap-1">
                <span className="text-gray-400">Hoje</span>
                <span className="text-sm font-semibold text-[#D6C6AA]">
                  {brl(revenueToday)}
                </span>
              </div>
              <div className="rounded-xl bg-gray-900/70 px-3 py-2 flex flex-col gap-1">
                <span className="text-gray-400">Semana</span>
                <span className="text-sm font-semibold text-[#D6C6AA]">
                  {brl(revenueWeek)}
                </span>
              </div>
              <div className="rounded-xl bg-gray-900/70 px-3 py-2 flex flex-col gap-1">
                <span className="text-gray-400">Ticket médio</span>
                <span className="text-sm font-semibold text-[#D6C6AA]">
                  {brl(averageTicket)}
                </span>
              </div>
            </div>
          </div>

          {/* KPIs extras (sem gráfico) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-gray-900 p-4 border border-gray-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide">
                  <Wallet className="w-4 h-4" />
                  Pagamentos aprovados
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-[#D6C6AA]">
                {totalPayments}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Total de registros com status aprovado.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-900 p-4 border border-gray-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide">
                  <BadgeCheck className="w-4 h-4" />
                  Clientes atendidos
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-[#D6C6AA]">
                {uniqueClients}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Clientes diferentes com pagamentos registrados.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-900 p-4 border border-gray-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide">
                  <CalendarDays className="w-4 h-4" />
                  Filtro atual
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#D6C6AA]">
                {range === "today"
                  ? "Somente hoje"
                  : range === "week"
                  ? "Semana atual"
                  : range === "month"
                  ? "Mês atual"
                  : "Todos os registros"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Este filtro é aplicado na tabela de movimentações abaixo.
              </p>
            </div>
          </div>
        </div>

        {/* Coluna lateral – distribuição + profissionais + pendentes */}
        <div className="2xl:col-span-6 space-y-4">
          {/* Distribuição por método (sem gráfico) */}
          <div className="rounded-2xl bg-gray-900 p-5 border border-gray-800">
            <p className="text-sm font-semibold text-[#D6C6AA] mb-1">
              Distribuição por método de pagamento
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Somente pagamentos aprovados, agrupados por método.
            </p>

            {methodDistribution.length === 0 ? (
              <p className="text-xs text-gray-500">
                Registre pagamentos para visualizar esta estatística.
              </p>
            ) : (
              <div className="space-y-3">
                {methodDistribution.map((m) => (
                  <div key={m.name} className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">{m.name}</span>
                      <span className="text-[#D6C6AA] font-semibold">
                        {brl(m.value)}{" "}
                        <span className="text-[11px] text-gray-500">
                          ({m.percent.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D6C6AA]"
                        style={{ width: `${m.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Faturamento por profissional */}
          <div className="rounded-2xl bg-gray-900 p-5 border border-gray-800">
            <p className="text-sm font-semibold text-[#D6C6AA] mb-1">
              Faturamento por profissional
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Total recebido em pagamentos aprovados, por profissional.
            </p>

            {revenueByProfessional.length === 0 ? (
              <p className="text-xs text-gray-500">
                Ainda não há registros de faturamento por profissional.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {revenueByProfessional.map((prof) => (
                  <div
                    key={prof.name}
                    className="flex items-center justify-between bg-gray-800/60 rounded-xl px-3 py-2 text-xs"
                  >
                    <span className="text-gray-200">{prof.name}</span>
                    <span className="text-[#D6C6AA] font-semibold">
                      {brl(prof.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagamentos pendentes */}
          <div className="rounded-2xl bg-gray-900 p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-semibold text-[#D6C6AA]">
                  Pagamentos pendentes
                </p>
              </div>
              <span className="text-[11px] text-gray-500">
                {pendingRows.length} pendente(s)
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Pagamentos com status pendente. Você pode marcar como pago após a
              confirmação.
            </p>

            {pendingRows.length === 0 ? (
              <p className="text-xs text-gray-400">
                Nenhum pagamento pendente no momento.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {pendingRows.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={p.clientName} src={p.clientImage} size={24} />
                      <div className="flex flex-col">
                        <span className="text-gray-100 font-medium">
                          {p.clientName}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {p.serviceName ?? "Serviço não informado"} •{" "}
                          {safeDateTime(p.dateISO)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-semibold text-[#D6C6AA]">
                        {brl(p.amount)}
                      </span>
                      <button
                        onClick={() => markPaymentAsApproved(p.id)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-[#D6C6AA] text-black font-medium hover:opacity-90"
                      >
                        Marcar como pago
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtros da tabela */}
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

        <span className="text-xs text-gray-500">
          {filteredRows.length} movimentações dentro do período selecionado
        </span>
      </div>

      {/* Tabela de movimentações */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-[#D6C6AA]">
              Movimentações
            </h3>
            <p className="text-xs text-gray-500">
              Lista consolidada de todos os pagamentos registrados.
            </p>
          </div>
          <span className="text-xs text-gray-500">
            {filteredRows.length} registros encontrados
          </span>
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
                <th className="px-6 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const normalizedStatus = normalizeStatus(r.status);
                const approved = isApprovedStatus(r.status);
                const pending = isPendingStatus(r.status);

                const badge = approved
                  ? "bg-green-700/60 text-green-100"
                  : pending
                  ? "bg-yellow-700/60 text-yellow-100"
                  : "bg-red-700/60 text-red-100";

                const label = approved
                  ? "Aprovado"
                  : pending
                  ? "Pendente"
                  : "Falhou";

                return (
                  <tr
                  key={r.id}
                  className="border-t border-gray-800 cursor-pointer hover:bg-gray-800/50"
onClick={() => {
  const original = payments.find(p => p.id === r.id);
  if (!original) return;

  // converte PaymentRow → RowUI completo
  const merged: RowUI = {
    ...r,
    method: original.method ?? r.method ?? "Outro",
    amount: Number(original.amount ?? r.amount),
    status: original.status ?? r.status,
  };

  setSelectedPayment(merged);
  setIsDetailsOpen(true);
}}
                >
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

                    <td className="px-6 py-3 text-right">
  <button
    onClick={() => {
      setSelectedPayment(r);
      setIsDetailsOpen(true);
    }}
    className="px-2 py-1 rounded bg-gray-800 text-[#D6C6AA] hover:bg-gray-700 text-xs"
  >
    Detalhes
  </button>
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-xl bg-gray-900 p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-[#D6C6AA]">
                Registrar pagamento
              </h4>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={savePayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Cliente
                  </label>
                  <select
                    name="client_id"
                    value={paymentForm.client_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm"
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
                    Vincular a agendamento (opcional)
                  </label>
                  <select
                    name="appointment_id"
                    value={paymentForm.appointment_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {appointments.slice(0, 100).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.clients?.full_name ?? "Sem cliente"} •{" "}
                        {a.services?.name ?? "sem serviço"} •{" "}
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
                    className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm"
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
                  <label className="block text-sm text-gray-300 mb-1">
                    Serviço (opcional)
                  </label>
                  <select
                    name="service_id"
                    value={paymentForm.service_id}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm"
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
                  <label className="block text-sm text-gray-300 mb-1">
                    Valor
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={paymentForm.amount}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Método
                  </label>
                  <select
                    name="method"
                    value={paymentForm.method}
                    onChange={onPaymentChange}
                    className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm"
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#D6C6AA] text-black text-sm font-medium"
                >
                  Salvar
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}
{isDetailsOpen && (
  <PaymentDetailsModal
    payment={selectedPayment}
    onClose={() => setIsDetailsOpen(false)}
    onEdit={handleEditPayment}
    onCancel={handleCancelPayment}
    onDelete={handleDeletePayment}
    onRefund={handleRefundPayment}
  />
)}

    </div>
  );
}