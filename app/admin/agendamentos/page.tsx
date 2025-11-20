"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useLowStock } from "../LowStockContext";
import {
  Plus,
  MessageCircle,
  Trash2,
  CalendarClock,
  Clock,
} from "lucide-react";
import React from "react";
import { CalendarDays } from "lucide-react";


interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  payment_status: "pending" | "paid" | "failed";
  services: { id: string; name: string; price: number } | null;
  professionals: {
    id: string;
    name: string;
    specialty: string;
    image_url?: string;
  } | null;
  clients: { full_name: string; phone: string; email: string } | null;
}

interface RescheduleState {
  id: string;
  newDate: string;
  slots: string[];
  selectedSlot: string;
  professional_id: string;
  service_id: string;
}

export default function AdminAgendamentosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);
  const [reschedule, setReschedule] = useState<RescheduleState>({
    id: "",
    newDate: "",
    slots: [],
    selectedSlot: "",
    professional_id: "",
    service_id: "",
  });
  const [weekFilter, setWeekFilter] = useState<"current" | "next" | "all">("current");
  const [activeDay, setActiveDay] = useState("Todos");


  function filterCurrentWeek(appointments: Appointment[]) {
    const now = new Date();
  
    const dayOfWeek = now.getDay(); // 0 = domingo
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
    // Segunda-feira
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
  
    // Domingo
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
  
    return appointments.filter((appt) => {
      const d = new Date(appt.start_time);
      return d >= monday && d <= sunday;
    });
  }
  

  function groupByWeekday(appointments: Appointment[]) {
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
  
    appointments.forEach((appt) => {
      const date = new Date(appt.start_time);
      const weekday = days[date.getDay()];
  
      if (!groups[weekday]) groups[weekday] = [];
      groups[weekday].push(appt);
    });
  
    // Ordem correta dentro de cada dia
    Object.keys(groups).forEach((day) => {
      groups[day].sort(
        (a, b) =>
          new Date(a.start_time).getTime() -
          new Date(b.start_time).getTime()
      );
    });
  
    // ordenar os dias da semana
    const ordered: Record<string, Appointment[]> = {};
    days.forEach((d) => {
      if (groups[d]) ordered[d] = groups[d];
    });
  
    return ordered;
  }
  

  function formatAppointmentDateTime(iso: string) {
    if (!iso) return "";
  
    const d = new Date(iso);
    const localMs = d.getTime() - new Date().getTimezoneOffset() * 60000;
    const local = new Date(localMs);
  
    return local.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  

  const { clearNewAppointments } = useLowStock();

  /* =========================================================
   * Effects
   * ======================================================= */

  // limpar badge de novos agendamentos
  useEffect(() => {
    clearNewAppointments();
  }, [clearNewAppointments]);

  // carregar profissionais
  useEffect(() => {
    async function fetchProfessionals() {
      const { data } = await supabase
        .from("professionals")
        .select("id, name")
        .order("name");
      setProfessionals(data || []);
    }
    fetchProfessionals();
  }, []);

  // carregar agendamentos conforme filtros
  useEffect(() => {
    fetchAppointments();
  }, [filterStatus, filterProfessional]);

  // realtime de novos agendamentos
  useEffect(() => {
    const channel = supabase
      .channel("realtime-appointments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload) => {
          setAppointments((prev) => [payload.new as any, ...prev]);
          playSound();
          showNotification("💅 Novo agendamento recebido!");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function getWeekRange(type: "current" | "next") {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
  
    // Segunda da semana atual
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
  
    // Domingo da semana atual
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
  
    if (type === "next") {
      monday.setDate(monday.getDate() + 7);
      sunday.setDate(sunday.getDate() + 7);
    }
  
    return { monday, sunday };
  }
  

  /* =========================================================
   * Helpers
   * ======================================================= */

  const playSound = () => {
    try {
      const audio = new Audio("/sounds/notify.mp3");
      audio.play().catch(() => {
        // usuário pode ter bloqueado autoplay; ignora erro
      });
    } catch {
      // ignora
    }
  };

  const showNotification = (message: string) => {
    const toast = document.createElement("div");
    toast.className =
      "fixed bottom-4 right-4 bg-[#D6C6AA] text-black px-5 py-3 rounded-lg shadow-lg animate-fadeIn z-[9999]";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  async function fetchAppointments() {
    setLoading(true);
    setError(null);

    try {
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
        .order("start_time", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterProfessional !== "all")
        query = query.eq("professional_id", filterProfessional);

      const { data, error } = await query;
      if (error) throw error;

      const parsed = (data || []).map((item: any) => ({
        ...item,
        services: Array.isArray(item.services) ? item.services[0] : item.services,
        professionals: Array.isArray(item.professionals)
          ? item.professionals[0]
          : item.professionals,
        clients: Array.isArray(item.clients) ? item.clients[0] : item.clients,
      }));
      
      setAppointments(parsed);

      
    } catch (err: any) {
      console.error("Erro ao buscar agendamentos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
      fetchAppointments();
    } catch (err: any) {
      console.error("Erro ao atualizar status:", err);
      setError(err.message);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm("Deseja excluir este agendamento?")) return;

    const res = await fetch("/api/appointments/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erro ao excluir agendamento:", data.error);
      showNotification("❌ Erro ao excluir!");
      return;
    }

    showNotification("🗑️ Agendamento excluído!");
    fetchAppointments();
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

    const res = await fetch("/api/appointments/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: reschedule.id,
        newDate: reschedule.selectedSlot,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erro ao reagendar:", data.error);
      showNotification("❌ Erro ao reagendar!");
      return;
    }

    showNotification("📅 Reagendado!");
    setReschedule({
      id: "",
      newDate: "",
      slots: [],
      selectedSlot: "",
      professional_id: "",
      service_id: "",
    });
    fetchAppointments();
  };

  const clearCompletedAppointments = async () => {
    if (!confirm("Excluir todos os agendamentos concluídos?")) return;
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("status", "completed");
    if (!error) showNotification("🧹 Concluídos removidos!");
    fetchAppointments();
  };

  const getStatusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "pending":
        return "text-yellow-400";
      case "confirmed":
        return "text-green-400";
      case "cancelled":
        return "text-red-400";
      case "completed":
        return "text-blue-400";
      default:
        return "text-gray-400";
    }
  };

  /* =========================================================
   * Render
   * ======================================================= */

  const filteredAppointments = (() => {
    if (weekFilter === "all") return appointments;
  
    const { monday, sunday } = getWeekRange(weekFilter);
  
    return appointments.filter((appt) => {
      const d = new Date(appt.start_time);
      return d >= monday && d <= sunday;
    });
  })();
  // 🔥 FILTRA PELA ABA SELECIONADA (TAB)
const dayFilteredAppointments = (() => {
  if (activeDay === "Todos") return filteredAppointments;

  const days = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];

  return filteredAppointments.filter((appt) => {
    const d = new Date(appt.start_time);
    return days[d.getDay()] === activeDay;
  });
})();


  if (loading)
    return <p className="text-[#D6C6AA] p-6">Carregando agendamentos...</p>;
  if (error) return <p className="text-red-500 p-6">Erro: {error}</p>;

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-3">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">
          Gerenciar Agendamentos
        </h2>
        <div className="flex gap-3">
          <Link
            href="/admin/agendamentos/novo"
            className="flex items-center gap-2 bg-[#D6C6AA] text-black font-medium px-5 py-2 rounded-lg hover:opacity-90 transition"
          >
            <Plus className="w-5 h-5" /> Novo agendamento
          </Link>

          <button
            onClick={clearCompletedAppointments}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            🧹 Limpar Concluídos
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <select
  value={weekFilter}
  onChange={(e) => setWeekFilter(e.target.value as any)}
  className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg"
>
  <option value="current">Semana atual</option>
  <option value="next">Próxima semana</option>
  <option value="all">Todos</option>
</select>


      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="confirmed">Confirmados</option>
          <option value="cancelled">Cancelados</option>
          <option value="completed">Concluídos</option>
        </select>

        <select
          value={filterProfessional}
          onChange={(e) => setFilterProfessional(e.target.value)}
          className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg"
        >
          <option value="all">Todos os profissionais</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

{/* TABS POR DIA */}
<div className="flex flex-wrap gap-2 mb-6">
  {[
    "Todos",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ].map((day) => (
    <button
      key={day}
      onClick={() => setActiveDay(day)} // <- precisa criar esse estado
      className={`
        px-4 py-2 rounded-lg text-sm font-medium border 
        ${
          activeDay === day
            ? "bg-[#D6C6AA] text-black border-[#D6C6AA]"
            : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
        }
      `}
    >
      {day}
    </button>
  ))}
</div>

      {/* TABELA */}
      {dayFilteredAppointments.length === 0 ? (
  <p className="text-gray-400">Nenhum agendamento encontrado.</p>
) : (
        <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Profissional
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Serviço
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Data e hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">

{Object.entries(groupByWeekday(dayFilteredAppointments))
.map(([weekday, appts]) => (
  <React.Fragment key={weekday}>

    {/* --- HEADER DO DIA --- */}
    <tr>
      <td colSpan={7} className="px-6 py-4 bg-gray-950 border-y border-gray-800">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#D6C6AA]" />
          <span className="text-[#D6C6AA] font-semibold text-base">
            {weekday}
          </span>

          <span className="text-gray-500 ml-2 text-sm">
            {new Date(appts[0].start_time).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </td>
    </tr>

    {/* --- LISTA DE AGENDAMENTOS DO DIA --- */}
    {appts.map((appt) => {
      const service = appt.services;
      const professional = appt.professionals;
      const client = appt.clients;

      return (
        <tr key={appt.id} className="hover:bg-gray-800/60 transition">

          {/* CLIENTE */}
          <td className="px-6 py-4">
            <div className="text-white font-medium flex items-center gap-2">
              {client?.full_name}

              {client?.phone && (
                <a
                  href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-500"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-sm text-gray-400">{client?.email}</p>
            <p className="text-sm text-gray-500">{client?.phone}</p>
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
              <p className="text-white font-medium">{professional?.name}</p>
              <p className="text-sm text-gray-400">{professional?.specialty}</p>
            </div>
          </td>

          {/* SERVIÇO */}
          <td className="px-6 py-4">
            <p className="text-white font-medium">{service?.name}</p>
            <p className="text-sm text-gray-400">
              R$ {service?.price?.toFixed(2).replace(".", ",")}
            </p>
          </td>

          {/* DATA & HORA */}
          <td className="px-6 py-4 text-gray-300">
            {formatAppointmentDateTime(appt.start_time)}
          </td>

          {/* STATUS */}
          <td className="px-6 py-4">
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                appt.status
              )}`}
            >
              {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
            </span>
          </td>

          {/* PAGAMENTO */}
          <td className="px-6 py-4 text-gray-300">
            {["pago", "paid"].includes(appt.payment_status)
              ? "Pago"
              : ["pendente", "pending"].includes(appt.payment_status)
              ? "Pendente"
              : "Falhou"}
          </td>

          {/* AÇÕES */}
          <td className="px-6 py-4 text-right">
            <div className="flex justify-end gap-2">
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
              >
                <CalendarClock className="w-5 h-5" />
              </button>

              <button
                onClick={() => updateAppointmentStatus(appt.id, "completed")}
                className="text-blue-400 hover:text-blue-600"
              >
                <Clock className="w-5 h-5" />
              </button>

              <button
                onClick={() => deleteAppointment(appt.id)}
                className="text-red-500 hover:text-red-700"
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
                  newDate: newDate,
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

            {/* BOTÕES */}
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
