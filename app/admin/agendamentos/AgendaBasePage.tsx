"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  MessageCircle,
  CalendarClock,
  Clock,
  Trash2,
  Plus,
} from "lucide-react";
import { CalendarDays } from "lucide-react";

/* ============================================================
 * Tipos
 * ============================================================ */
interface Appointment {
  id: string;
  start_time: string;
  end_time: string | null;

  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "rescheduled"
    | string;

  payment_status:
    | "pending"
    | "paid"
    | "failed"
    | "pendente"
    | "pago"
    | "falhou"
    | string;

  services?: { id: string; name: string; price: number | null } | null;

  professionals?: {
    id: string;
    name: string;
    specialty: string | null;
    image_url?: string | null;
  } | null;

  clients?: {
    full_name: string;
    phone: string;
    email: string | null;
  } | null;
}

interface RescheduleState {
  id: string;
  newDate: string;      // YYYY-MM-DD da data selecionada
  currentTime: string;  // HH:MM do horário atual do agendamento
  slots: string[];      // horários disponíveis vindos da API
  selectedSlot: string; // horário escolhido para reagendar
  professional_id: string;
  service_id: string;
}

interface CompleteState {
  open: boolean;
  appointmentId: string;
  amount: number;
  method: string;
  paymentStatus: "pago" | "pendente";
}

/* ============================================================
 * Constantes
 * ============================================================ */
const WEEK_DAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/* ============================================================
 * Componente principal
 * ============================================================ */
export default function AgendaBasePage({
  title,
  statusFilter,
}: {
  title: string;
  statusFilter: "active" | "completed" | "cancelled" | "rescheduled";
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [reschedule, setReschedule] = useState<RescheduleState>({
    id: "",
    newDate: "",
    currentTime: "",
    slots: [],
    selectedSlot: "",
    professional_id: "",
    service_id: "",
  });

  const [completeModal, setCompleteModal] = useState<CompleteState>({
    open: false,
    appointmentId: "",
    amount: 0,
    method: "Pix",
    paymentStatus: "pago",
  });

  const today = new Date();

  /* ============================================================
   * Função de notificação
   * ============================================================ */
  const showNotification = (message: string) => {
    const toast = document.createElement("div");
    toast.className =
      "fixed bottom-4 right-4 bg-[#D6C6AA] text-black px-5 py-3 rounded-lg shadow-lg animate-fadeIn z-[9999]";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const getStatusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "pending":
      case "pendente":
        return "bg-yellow-700/30 text-yellow-300";
      case "confirmed":
        return "bg-green-700/30 text-green-300";
      case "cancelled":
        return "bg-red-700/30 text-red-300";
      case "completed":
        return "bg-blue-700/30 text-blue-300";
      case "rescheduled":
        return "bg-purple-700/30 text-purple-300";
      default:
        return "bg-gray-700/30 text-gray-300";
    }
  };

  const formatAppointmentDateTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const isSameDay = (iso: string, ref: Date) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === ref.getFullYear() &&
      d.getMonth() === ref.getMonth() &&
      d.getDate() === ref.getDate()
    );
  };

  /* ============================================================
   * Carregar agendamentos
   * ============================================================ */
  async function load() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("appointments")
        .select(
          `
          id,
          start_time,
          end_time,
          status,
          payment_status,
          services:service_id (id, name, price),
          professionals:professional_id (id, name, specialty, image_url),
          clients:client_id (full_name, phone, email)
        `
        )
        .order("start_time", { ascending: true });

      if (statusFilter === "active") {
        query = query
          .neq("status", "completed")
          .neq("status", "cancelled")
          .neq("status", "rescheduled");
      } else {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const parsed = (data || []).map((item: any): Appointment => ({
        ...item,
        services: Array.isArray(item.services)
          ? item.services[0]
          : item.services,
        professionals: Array.isArray(item.professionals)
          ? item.professionals[0]
          : item.professionals,
        clients: Array.isArray(item.clients) ? item.clients[0] : item.clients,
      }));

      setAppointments(parsed);
    } catch (err: any) {
      console.error("Erro ao carregar agendamentos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  /* ============================================================
   * Atualizar status + financeiro
   * ============================================================ */
  const updateAppointmentStatus = async (
    id: string,
    newStatus: Appointment["status"],
    opts?: { markPaid?: boolean; method?: string; amount?: number }
  ) => {
    try {
      const res = await fetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          markPaid: opts?.markPaid ?? false,
          method: opts?.method,
          amount: opts?.amount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar status");

      showNotification("✅ Status atualizado!");
      await load();
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao atualizar status");
    }
  };

  /* ============================================================
   * Modal CONCLUIR → abre com preço do serviço
   * ============================================================ */
  const handleOpenCompleteModal = (appt: Appointment) => {
    const service: any = appt.services;
    const amount = Number(service?.price || 0);

    setCompleteModal({
      open: true,
      appointmentId: appt.id,
      amount,
      method: "Pix",
      paymentStatus: "pago",
    });
  };

  /* ============================================================
   * Confirmar conclusão
   * ============================================================ */
  const handleConfirmComplete = async () => {
    if (!completeModal.appointmentId) return;

    await updateAppointmentStatus(completeModal.appointmentId, "completed", {
      markPaid: completeModal.paymentStatus === "pago",
      method: completeModal.method,
      amount: completeModal.amount,
    });

    setCompleteModal({
      open: false,
      appointmentId: "",
      amount: 0,
      method: "Pix",
      paymentStatus: "pago",
    });
  };

  /* ============================================================
   * Excluir agendamento
   * ============================================================ */
  const deleteAppointment = async (id: string) => {
    if (!confirm("Deseja excluir este agendamento?")) return;

    try {
      const res = await fetch("/api/appointments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir");

      showNotification("🗑️ Agendamento excluído!");
      await load();
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao excluir agendamento");
    }
  };

  /* ============================================================
   * Buscar horários disponíveis para reagendamento
   * (mesma ideia do "novo agendamento")
   * ============================================================ */
  const fetchAvailableSlots = async (
    date: string,
    service_id: string,
    professional_id: string
  ) => {
    if (!date || !service_id || !professional_id) return;

    try {
      const result = await fetch("/api/appointments/available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          service_id,
          professional_id,
        }),
      });

const json = await result.json();
const slots: string[] = json?.available ?? [];

setReschedule((prev) => ({
  ...prev,
  slots,
  // se o horário atual ainda estiver livre, já deixa pré-selecionado
  selectedSlot:
    prev.selectedSlot ||
    (slots.includes(prev.currentTime) ? prev.currentTime : ""),
}));
    } catch (err) {
      console.error("Erro ao buscar horários disponíveis:", err);
      showNotification("❌ Erro ao carregar horários disponíveis");
    }
  };

  /* ============================================================
   * Agrupar por dia
   * ============================================================ */
  function groupByDay(list: Appointment[]) {
    const groups: Record<string, Appointment[]> = {};

    list.forEach((appt) => {
      const d = new Date(appt.start_time);
      const day = WEEK_DAYS[d.getDay()];
      if (!groups[day]) groups[day] = [];
      groups[day].push(appt);
    });

    Object.keys(groups).forEach((day) => {
      groups[day].sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    });

    return groups;
  }

  const filteredBySearch = appointments.filter((appt) => {
    if (!search.trim()) return true;
    const name = appt.clients?.full_name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const grouped = groupByDay(filteredBySearch);

  const todaysPendingCount = appointments.filter(
    (appt) =>
      isSameDay(appt.start_time, today) &&
      appt.status !== "completed" &&
      appt.status !== "cancelled"
  ).length;

  const todayWeekdayName = WEEK_DAYS[today.getDay()];

  /* ============================================================
   * Render
   * ============================================================ */
  if (loading)
    return <p className="text-[#D6C6AA] p-6">Carregando agendamentos...</p>;
  if (error) return <p className="text-red-500 p-6">Erro: {error}</p>;

  return (
    <div className="p-6">
      {/* MENU */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/agendamentos"
            className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Ativos
            {statusFilter === "active" && todaysPendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-600 text-white">
                {todaysPendingCount}
              </span>
            )}
          </Link>

          <Link
            href="/admin/agendamentos/concluidos"
            className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Concluídos
          </Link>

          <Link
            href="/admin/agendamentos/cancelados"
            className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Cancelados
          </Link>

          <Link
            href="/admin/agendamentos/reagendados"
            className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Reagendados
          </Link>
        </div>

        <Link
          href="/admin/agendamentos/novo"
          className="flex items-center gap-2 bg-[#D6C6AA] text-black font-medium px-5 py-2 rounded-lg hover:opacity-90 transition"
        >
          <Plus className="w-5 h-5" /> Novo agendamento
        </Link>
      </div>

      {/* TÍTULO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold text-[#D6C6AA]">{title}</h2>

          {statusFilter === "active" && todaysPendingCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-600 text-white">
              {todaysPendingCount} hoje
            </span>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full md:w-80 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100"
        />
      </div>

      {/* LISTA */}
      <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                Profissional
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                Serviço
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                Data / Hora
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                Pagamento
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs text-gray-400 uppercase">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800">
            {Object.entries(grouped).map(([dayName, appts]) => (
              <React.Fragment key={dayName}>
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 bg-gray-950 border-y border-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-[#D6C6AA]" />
                      <span className="text-[#D6C6AA] font-semibold">
                        {dayName}
                      </span>

                      {dayName === todayWeekdayName && (
                        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-600 text-white">
                          Hoje
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

                {appts.map((appt) => {
                  const service: any = appt.services;
                  const professional: any = appt.professionals;
                  const client: any = appt.clients;

                  const canConclude =
                    appt.status !== "completed" &&
                    appt.status !== "cancelled";

                  const canReschedule = appt.status !== "cancelled";

                  const paymentText = ["pago", "paid"].includes(
                    (appt.payment_status || "").toLowerCase()
                  )
                    ? "Pago"
                    : ["pendente", "pending"].includes(
                        (appt.payment_status || "").toLowerCase()
                      )
                    ? "Pendente"
                    : "Falhou";

                  const isTodayRow =
                    isSameDay(appt.start_time, today) &&
                    appt.status !== "completed";

                  return (
                    <tr
                      key={appt.id}
                      className={`hover:bg-gray-800/60 transition ${
                        isTodayRow
                          ? "border-l-4 border-red-500 bg-red-500/5"
                          : ""
                      }`}
                    >
                      {/* CLIENTE */}
                      <td className="px-6 py-4">
                        <div className="text-white font-medium flex items-center gap-2">
                          {client?.full_name}

                          {client?.phone && (
                            <a
                              href={`https://wa.me/55${client.phone.replace(
                                /\D/g,
                                ""
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-400 hover:text-green-500"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>

                        <p className="text-sm text-gray-400">
                          {client?.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {client?.phone}
                        </p>
                      </td>

                      {/* PROFISSIONAL */}
                      <td className="px-6 py-4 flex items-center gap-3">
                        {professional?.image_url ? (
                          <Image
                            src={professional.image_url}
                            alt={professional.name}
                            width={32}
                            height={32}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700" />
                        )}

                        <div>
                          <p className="text-white font-medium">
                            {professional?.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {professional?.specialty}
                          </p>
                        </div>
                      </td>

                      {/* SERVIÇO */}
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">
                          {service?.name}
                        </p>

                        {service?.price != null && (
                          <p className="text-sm text-gray-400">
                            R{" "}
                            {`${Number(service.price || 0)
                              .toFixed(2)
                              .replace(".", ",")}`}
                          </p>
                        )}
                      </td>

                      {/* DATA */}
                      <td className="px-6 py-4 text-gray-300">
                        {formatAppointmentDateTime(appt.start_time)}
                      </td>

                      {/* PAGAMENTO */}
                      <td className="px-6 py-4 text-gray-300">
                        {paymentText}
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            appt.status
                          )}`}
                        >
                          {String(appt.status)
                            .charAt(0)
                            .toUpperCase() +
                            String(appt.status).slice(1)}
                        </span>
                      </td>

                      {/* AÇÕES */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {canReschedule && (
                            <button
                              onClick={async () => {
                                // Data local em pt-BR e depois convertida para YYYY-MM-DD
                                const localDate = new Date(
                                  appt.start_time
                                ).toLocaleDateString("pt-BR", {
                                  timeZone: "America/Sao_Paulo",
                                });
                                const [dia, mes, ano] = localDate.split("/");
                                const isoDate = `${ano}-${mes}-${dia}`;

                                const localTime = new Date(
                                  appt.start_time
                                ).toLocaleTimeString("pt-BR", {
                                  timeZone: "America/Sao_Paulo",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                });

                                setReschedule({
                                  id: appt.id,
                                  newDate: isoDate,
                                  currentTime: localTime,
                                  slots: [],
                                  selectedSlot: "",
                                  professional_id: professional?.id || "",
                                  service_id: service?.id || "",
                                });

                                await fetchAvailableSlots(
                                  isoDate,
                                  service?.id || "",
                                  professional?.id || ""
                                );
                              }}
                              className="text-yellow-400 hover:text-yellow-600"
                              title="Reagendar"
                            >
                              <CalendarClock className="w-5 h-5" />
                            </button>
                          )}

                          {canConclude && (
                            <button
                              onClick={() => handleOpenCompleteModal(appt)}
                              className="text-blue-400 hover:text-blue-600"
                              title="Concluir"
                            >
                              <Clock className="w-5 h-5" />
                            </button>
                          )}

                          <button
                            onClick={() => deleteAppointment(appt.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================
       * MODAL DE CONCLUSÃO
       * ============================================================ */}
      {completeModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 w-full max-w-sm">
            <h3 className="text-xl font-bold text-[#D6C6AA] mb-4">
              Concluir agendamento
            </h3>

            <p className="text-sm text-gray-300 mb-3">
              Ao concluir, o agendamento será marcado como{" "}
              <span className="font-semibold">Concluído</span>. O lançamento
              financeiro poderá ser <span className="font-semibold">Pago</span>{" "}
              ou <span className="font-semibold">Pendente</span>.
            </p>

            <div className="space-y-3 mb-4">
              {/* Valor */}
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Valor
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={completeModal.amount}
                  onChange={(e) =>
                    setCompleteModal((prev) => ({
                      ...prev,
                      amount: Number(e.target.value || 0),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white"
                />
              </div>

              {/* Método */}
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Método de pagamento
                </label>
                <select
                  value={completeModal.method}
                  onChange={(e) =>
                    setCompleteModal((prev) => ({
                      ...prev,
                      method: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white"
                >
                  <option value="Pix">Pix</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Status do Pagamento
                </label>

                <select
                  value={completeModal.paymentStatus}
                  onChange={(e) =>
                    setCompleteModal((prev) => ({
                      ...prev,
                      paymentStatus: e.target.value as "pago" | "pendente",
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white mb-3"
                >
                  <option value="pago">Pago agora</option>
                  <option value="pendente">Pendente (não pagar agora)</option>
                </select>
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  setCompleteModal({
                    open: false,
                    appointmentId: "",
                    amount: 0,
                    method: "Pix",
                    paymentStatus: "pago",
                  })
                }
                className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmComplete}
                className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg hover:bg-[#e8dcbf]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
       * MODAL DE REAGENDAMENTO
       * ============================================================ */}
      {reschedule.id && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 w-full max-w-md p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-4">
              Reagendar
            </h2>

            {/* DATA ATUAL */}
            <p className="text-gray-400 mb-2">
              Data atual:{" "}
              <span className="text-[#D6C6AA] font-medium">
                {reschedule.newDate
                  .split("-")
                  .reverse()
                  .join("/")}{" "}
                às {reschedule.currentTime}
              </span>
            </p>

            {/* INPUT DE DATA */}
            <label className="block text-gray-300 text-sm mb-1">
              Nova data
            </label>

            <input
              type="date"
              className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg mb-3"
              value={reschedule.newDate}
              onChange={async (e) => {
                const newDate = e.target.value;

                setReschedule((prev) => ({
                  ...prev,
                  newDate,
                  slots: [],
                  selectedSlot: "",
                }));

                await fetchAvailableSlots(
                  newDate,
                  reschedule.service_id,
                  reschedule.professional_id
                );
              }}
            />

            {/* HORÁRIOS DISPONÍVEIS */}
            <div className="mt-4">
              <p className="text-gray-300 text-sm mb-2">
                Horários disponíveis
              </p>

              {reschedule.slots.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Selecione uma data para ver os horários.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {reschedule.slots.map((time) => (
                    <button
                      key={time}
                      onClick={() =>
                        setReschedule((prev) => ({
                          ...prev,
                          selectedSlot: time,
                        }))
                      }
                      className={`px-3 py-2 rounded-lg text-sm transition ${
                        reschedule.selectedSlot === time
                          ? "bg-[#D6C6AA] text-black"
                          : "bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BOTÕES */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() =>
                  setReschedule({
                    id: "",
                    newDate: "",
                    currentTime: "",
                    slots: [],
                    selectedSlot: "",
                    professional_id: "",
                    service_id: "",
                  })
                }
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>

              <button
                disabled={!reschedule.selectedSlot}
                onClick={async () => {
                  const res = await fetch("/api/admin/reagendar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: reschedule.id,
                      date: reschedule.newDate,
                      time: reschedule.selectedSlot,
                    }),
                  });

                  const json = await res.json();
                  if (res.ok) {
                    showNotification(
                      "📅 Agendamento reagendado com sucesso!"
                    );
                    await load();
                  } else {
                    showNotification("❌ Erro ao reagendar: " + json.error);
                  }

                  setReschedule({
                    id: "",
                    newDate: "",
                    currentTime: "",
                    slots: [],
                    selectedSlot: "",
                    professional_id: "",
                    service_id: "",
                  });
                }}
                className={`px-4 py-2 rounded-lg ${
                  reschedule.selectedSlot
                    ? "bg-[#D6C6AA] text-black hover:bg-[#e8dcbf]"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
