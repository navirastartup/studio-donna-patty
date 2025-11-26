"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  CalendarDays,
  Clock,
  User2,
  ArrowRight,
  ExternalLink,
  Download,
} from "lucide-react";

/* ============================
 * Tipos
 * ============================ */
interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  service_id: string | null;
  professional_id: string | null;
  service: {
    name: string | null;
    description?: string | null;
    duration_minutes?: number | null;
    price?: number | null;
  } | null;
  professional: {
    name: string | null;
  } | null;
}

/* ============================
 * Helpers
 * ============================ */

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatHour(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number | null) {
  const v = Number(value ?? 0);
  return v.toFixed(2).replace(".", ",");
}

function getStatusConfig(status: string) {
  const s = status?.toLowerCase();

  if (s === "confirmed")
    return {
      label: "Confirmado",
      classes: "bg-green-700/25 text-green-200 border border-green-500/60",
    };
  if (s === "pending")
    return {
      label: "Pendente",
      classes: "bg-yellow-700/25 text-yellow-100 border border-yellow-500/60",
    };
  if (s === "cancelled")
    return {
      label: "Cancelado",
      classes: "bg-red-800/25 text-red-200 border border-red-500/60",
    };
  if (s === "finished" || s === "done")
    return {
      label: "Finalizado",
      classes: "bg-blue-800/25 text-blue-200 border border-blue-500/60",
    };

  return {
    label: status || "—",
    classes: "bg-gray-700/40 text-gray-200 border border-gray-500/50",
  };
}

/** Constrói URL para o Google Calendar */
function buildGoogleCalendarUrl(a: Appointment, client?: Client | null) {
  const title = encodeURIComponent(
    a.service?.name || "Atendimento Studio Donna Patty"
  );

  const description = encodeURIComponent(
    [
      a.service?.description || "",
      "",
      client?.full_name ? `Cliente: ${client.full_name}` : "",
      a.professional?.name ? `Profissional: ${a.professional.name}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  // Formato: YYYYMMDDTHHMMSS
  const start = new Date(a.start_time);
  const end = a.end_time ? new Date(a.end_time) : new Date(a.start_time);

  const pad = (n: number) => String(n).padStart(2, "0");

  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate()
    )}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  const dates = `${fmt(start)}/${fmt(end)}`;

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${description}`;
}

/** Baixa arquivo .ics para calendários Apple / Outlook */
function downloadICS(a: Appointment, client?: Client | null) {
  const title = a.service?.name || "Atendimento Studio Donna Patty";
  const descriptionLines = [
    a.service?.description || "",
    client?.full_name ? `Cliente: ${client.full_name}` : "",
    a.professional?.name ? `Profissional: ${a.professional.name}` : "",
  ].filter(Boolean);

  const start = new Date(a.start_time);
  const end = a.end_time ? new Date(a.end_time) : new Date(a.start_time);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate()
    )}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studio Donna Patty//Agenda Cliente//PT-BR",
    "BEGIN:VEVENT",
    `UID:${a.id}@studiodonnapatty`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    descriptionLines.length
      ? `DESCRIPTION:${descriptionLines.join("\\n")}`
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `agendamento-${a.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/* ============================
 * Página
 * ============================ */

export default function MinhaAgendaPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id as string | undefined;

  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- Buscar dados principais ---- */
  useEffect(() => {
    if (!clientId) return;

    async function load() {
      setLoading(true);
      setError(null);

      // Cliente
      const { data: clientData, error: clientErr } = await supabase
        .from("clients")
        .select("id, full_name, email, phone")
        .eq("id", clientId)
        .single();

      if (clientErr) {
        console.error(clientErr);
        setError("Não foi possível localizar esse cliente.");
        setLoading(false);
        return;
      }

      setClient(clientData as Client);

      // Agendamentos
      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select(
          `
            id,
            start_time,
            end_time,
            status,
            service_id,
            professional_id,
            services:service_id ( name, description, duration_minutes, price ),
            professionals:professional_id ( name )
          `
        )
        .eq("client_id", clientId)
        .order("start_time", { ascending: true });

      if (apptErr) {
        console.error(apptErr);
        setError("Erro ao carregar agendamentos.");
        setLoading(false);
        return;
      }

      const normalized: Appointment[] = (appts ?? []).map((a: any) => ({
        id: a.id,
        start_time: a.start_time,
        end_time: a.end_time ?? null,
        status: a.status,
        service_id: a.service_id ?? null,
        professional_id: a.professional_id ?? null,
        service: Array.isArray(a.services)
          ? a.services[0] ?? null
          : a.services ?? null,
        professional: Array.isArray(a.professionals)
          ? a.professionals[0] ?? null
          : a.professionals ?? null,
      }));

      setAppointments(normalized);
      setLoading(false);
    }

    load();
  }, [clientId]);

  /* ---- Realtime: atualizar em tempo real ---- */
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`client-appointments-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `client_id=eq.${clientId}`,
        },
        async () => {
          // Recarrega apenas os agendamentos quando algo mudar
          const { data: appts } = await supabase
            .from("appointments")
            .select(
              `
              id,
              start_time,
              end_time,
              status,
              service_id,
              professional_id,
              services:service_id ( name, description, duration_minutes, price ),
              professionals:professional_id ( name )
            `
            )
            .eq("client_id", clientId)
            .order("start_time", { ascending: true });

          const normalized: Appointment[] = (appts ?? []).map((a: any) => ({
            id: a.id,
            start_time: a.start_time,
            end_time: a.end_time ?? null,
            status: a.status,
            service_id: a.service_id ?? null,
            professional_id: a.professional_id ?? null,
            service: Array.isArray(a.services)
              ? a.services[0] ?? null
              : a.services ?? null,
            professional: Array.isArray(a.professionals)
              ? a.professionals[0] ?? null
              : a.professionals ?? null,
          }));

          setAppointments(normalized);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const nextAppointment = useMemo(() => {
    const now = new Date().toISOString();
    return (
      appointments.find((a) => a.start_time >= now && a.status !== "cancelled") ||
      null
    );
  }, [appointments]);

  if (!clientId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#05070b] text-[#D6C6AA]">
        Link inválido.
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#05070b] text-[#D6C6AA]">
        Carregando sua agenda...
      </main>
    );
  }

  if (error || !client) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#05070b] text-red-300">
        {error || "Não foi possível carregar sua agenda."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1b2130] flex items-center justify-center text-xl font-semibold">
              {client.full_name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#E8DCC3]">
                Olá, {client.full_name}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Aqui você vê todos os seus agendamentos no Studio Donna Patty.
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-400">
            <p>{client.email}</p>
            <p>{client.phone}</p>
          </div>
        </header>

        {/* Próximo agendamento em destaque */}
        {nextAppointment && (
          <section className="mb-8">
            <div className="rounded-2xl border border-[#E8DCC3]/30 bg-[#0b0f18] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-6 h-6 text-[#E8DCC3] mt-1" />
                <div>
                  <p className="text-sm text-gray-400">Próximo agendamento</p>
                  <p className="text-lg font-semibold text-[#E8DCC3]">
                    {nextAppointment.service?.name || "Serviço"}
                  </p>
                  <p className="text-sm text-gray-300 mt-1">
                    {formatDate(nextAppointment.start_time)} às{" "}
                    {formatHour(nextAppointment.start_time)}{" "}
                    {nextAppointment.professional?.name &&
                      `· com ${nextAppointment.professional.name}`}
                  </p>
                  {nextAppointment.service?.description && (
                    <p className="text-xs text-gray-400 mt-2">
                      {nextAppointment.service.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-2 text-xs">
                <button
                  onClick={() => downloadICS(nextAppointment, client)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161b28] border border-gray-600 text-gray-100 hover:bg-[#1f2636] transition"
                >
                  <Download className="w-3 h-3" />
                  Baixar para calendário
                </button>

                <a
                  href={buildGoogleCalendarUrl(nextAppointment, client)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E8DCC3] text-black font-medium hover:bg-[#f2e8d1] transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  Adicionar ao Google Calendar
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Lista de TODOS os agendamentos */}
        <section>
          <h2 className="text-lg font-semibold text-[#E8DCC3] mb-3">
            Todos os seus agendamentos
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Status em tempo real. Qualquer mudança feita pelo estúdio aparece
            aqui automaticamente.
          </p>

          {appointments.length === 0 ? (
            <p className="text-sm text-gray-400">
              Você ainda não possui agendamentos cadastrados.
            </p>
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => {
                const statusCfg = getStatusConfig(a.status);

                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-[#1f2535] bg-[#090d14] px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <CalendarDays className="w-3 h-3" />
                        <span>{formatDate(a.start_time)}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{formatHour(a.start_time)}</span>
                      </div>

                      <p className="mt-1 text-sm font-semibold text-[#E8DCC3]">
                        {a.service?.name || "Serviço"}
                      </p>

                      {a.professional?.name && (
                        <p className="text-xs text-gray-300 flex items-center gap-1 mt-0.5">
                          <User2 className="w-3 h-3" />
                          {a.professional.name}
                        </p>
                      )}

                      {a.service?.description && (
                        <p className="text-xs text-gray-400 mt-1">
                          {a.service.description}
                        </p>
                      )}

                      {typeof a.service?.price === "number" && (
                        <p className="text-xs text-gray-300 mt-1">
                          Valor do serviço: R$ {formatCurrency(a.service.price)}
                        </p>
                      )}

                      {a.service?.duration_minutes && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Duração aproximada: {a.service.duration_minutes} min
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2 text-xs">
                      <span
                        className={
                          "inline-flex items-center px-3 py-1 rounded-full " +
                          statusCfg.classes
                        }
                      >
                        {statusCfg.label}
                      </span>

                      {/* Reagendar – sem cancelar, apenas leva para o fluxo */}
                      <Link
                        href={
                          a.service_id
                            ? `/agendamento?service=${a.service_id}`
                            : "/agendamento"
                        }
                        className="inline-flex items-center gap-1 text-[#E8DCC3] hover:text-white"
                      >
                        Reagendar este serviço
                        <ArrowRight className="w-3 h-3" />
                      </Link>

                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadICS(a, client)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#151927] border border-gray-700 text-gray-200 hover:bg-[#1f2434] transition"
                        >
                          <Download className="w-3 h-3" />
                          .ICS
                        </button>

                        <a
                          href={buildGoogleCalendarUrl(a, client)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#E8DCC3]/90 text-black hover:bg-[#f6ecda] transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Google
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-10 text-center text-[11px] text-gray-500">
          Studio Donna Patty · Este link é exclusivo para você. Guarde com
          carinho 💜
        </footer>
      </div>
    </main>
  );
}
