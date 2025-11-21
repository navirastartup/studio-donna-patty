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
  newDate: string;
  slots: string[];
  selectedSlot: string;
  professional_id: string;
  service_id: string;
}

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
    slots: [],
    selectedSlot: "",
    professional_id: "",
    service_id: "",
  });

  useEffect(() => {
    load();
  }, [statusFilter]);

  /* ============================================
   * Helpers visuais / util
   * ============================================ */
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

function formatAppointmentDateTime(iso: string) {
  if (!iso) return "";

  // O Supabase já devolve a data em UTC corretamente.
  const d = new Date(iso);

  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

  /* ============================================
   * Carregar dados
   * ============================================ */
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

  /* ============================================
   * Ações (status / delete / reagendar)
   * ============================================ */
  const updateAppointmentStatus = async (
    id: string,
    newStatus: Appointment["status"]
  ) => {
    try {
      const res = await fetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar status");

      showNotification("✅ Status atualizado com sucesso!");
      load();
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao atualizar status");
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm("Deseja excluir este agendamento?")) return;

    try {
      const res = await fetch("/api/appointments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir agendamento");

      showNotification("🗑️ Agendamento excluído!");
      load();
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao excluir agendamento");
    }
  };

  const fetchAvailableSlots = async (
    date: string,
    professional_id: string,
    service_id: string
  ) => {
    if (!date) return;
    try {
      const res = await fetch("/api/appointments/available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, professional_id, service_id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar horários");

      setReschedule((prev) => ({ ...prev, slots: data.available || [] }));
    } catch (err) {
      console.error(err);
      setReschedule((prev) => ({ ...prev, slots: [] }));
    }
  };

  const rescheduleAppointment = async () => {
    if (!reschedule.id || !reschedule.selectedSlot) return;

    try {
      const res = await fetch("/api/appointments/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reschedule.id,
          newDate: reschedule.selectedSlot,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao reagendar");

      showNotification("📅 Agendamento reagendado!");
      setReschedule({
        id: "",
        newDate: "",
        slots: [],
        selectedSlot: "",
        professional_id: "",
        service_id: "",
      });
      load();
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao reagendar");
    }
  };

  /* ============================================
   * Agrupamento + busca
   * ============================================ */
  function groupByDay(list: Appointment[]) {
    const days = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];

    const groups: Record<string, Appointment[]> = {};

    list.forEach((appt) => {
      const d = new Date(appt.start_time);
      const day = days[d.getDay()];
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

  /* ============================================
   * Render
   * ============================================ */

  if (loading)
    return <p className="text-[#D6C6AA] p-6">Carregando agendamentos...</p>;
  if (error) return <p className="text-red-500 p-6">Erro: {error}</p>;

  return (
    <div className="p-6">
      {/* MENU ENTRE ROTAS */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/agendamentos"
            className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Ativos
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

      {/* TÍTULO + BUSCA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">{title}</h2>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full md:w-80 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D6C6AA]"
        />
      </div>

      {/* TABELA */}
      {filteredBySearch.length === 0 ? (
        <p className="text-gray-400">Nenhum agendamento encontrado.</p>
      ) : (
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
                  {/* Header do dia */}
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
                      </div>
                    </td>
                  </tr>

                  {/* Linhas do dia */}
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

                    return (
                      <tr
                        key={appt.id}
                        className="hover:bg-gray-800/60 transition"
                      >
                        {/* Cliente */}
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

                        {/* Profissional */}
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

                        {/* Serviço */}
                        <td className="px-6 py-4">
                          <p className="text-white font-medium">
                            {service?.name}
                          </p>
                          {service?.price != null && (
                            <p className="text-sm text-gray-400">
                              R{" "}
                              {`${
                                Number(service.price || 0)
                                  .toFixed(2)
                                  .replace(".", ",")
                              }`}
                            </p>
                          )}
                        </td>

                        {/* Data / Hora */}
                        <td className="px-6 py-4 text-gray-300">
                          {formatAppointmentDateTime(appt.start_time)}
                        </td>

                        {/* Pagamento */}
                        <td className="px-6 py-4 text-gray-300">
                          {paymentText}
                        </td>

                        {/* Status */}
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

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canReschedule && (
                              <button
                                onClick={() =>
                                  setReschedule({
                                    id: appt.id,
                                    newDate: "",
                                    slots: [],
                                    selectedSlot: "",
                                    professional_id: professional?.id || "",
                                    service_id: service?.id || "",
                                  })
                                }
                                className="text-yellow-400 hover:text-yellow-600"
                                title="Reagendar"
                              >
                                <CalendarClock className="w-5 h-5" />
                              </button>
                            )}

                            {canConclude && (
                              <button
                                onClick={() =>
                                  updateAppointmentStatus(appt.id, "completed")
                                }
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
      )}

      {/* MODAL DE REAGENDAMENTO */}
      {reschedule.id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 w-[90%] max-w-sm">
            <h3 className="text-xl font-bold text-[#D6C6AA] mb-4">
              Reagendar
            </h3>

            {/* DATA */}
            <input
              type="date"
              value={reschedule.newDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setReschedule((prev) => ({
                  ...prev,
                  newDate,
                  selectedSlot: "",
                }));
                fetchAvailableSlots(
                  newDate,
                  reschedule.professional_id,
                  reschedule.service_id
                );
              }}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white mb-4"
            />

            {/* HORÁRIOS DISPONÍVEIS */}
            {reschedule.slots && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {reschedule.slots.length === 0 && (
                  <p className="text-gray-400">Nenhum horário disponível</p>
                )}

                {reschedule.slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() =>
                      setReschedule((prev) => ({
                        ...prev,
                        selectedSlot: slot,
                      }))
                    }
                    className={`px-3 py-2 rounded-lg border ${
                      reschedule.selectedSlot === slot
                        ? "bg-[#D6C6AA] text-black"
                        : "bg-gray-800 text-white border-gray-600"
                    }`}
                  >
                    {new Date(slot).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            )}

            {/* BOTÕES MODAL */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  setReschedule({
                    id: "",
                    newDate: "",
                    slots: [],
                    selectedSlot: "",
                    professional_id: "",
                    service_id: "",
                  })
                }
                className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                disabled={!reschedule.selectedSlot}
                onClick={rescheduleAppointment}
                className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg hover:bg-[#e8dcbf] disabled:opacity-50"
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