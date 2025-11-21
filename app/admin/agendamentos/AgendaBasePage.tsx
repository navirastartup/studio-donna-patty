"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MessageCircle, CalendarClock, Clock, Trash2 } from "lucide-react";
import { CalendarDays } from "lucide-react";
import React from "react";


interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  services: any;
  professionals: any;
  clients: any;
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

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);

    let query = supabase
      .from("appointments")
      .select(
        `
        id,
        start_time,
        end_time,
        status,
        payment_status,
        services:service_id(id, name, price),
        professionals:professional_id(id, name, specialty, image_url),
        clients:client_id(full_name, phone, email)
      `
      )
      .order("start_time");

    if (statusFilter === "active") {
      query = query
        .neq("status", "completed")
        .neq("status", "cancelled")
        .neq("status", "rescheduled");
    } else {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    setAppointments(data || []);
    setLoading(false);
  }

function formatLocalDate(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);

  return local.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}


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

  const grouped = groupByDay(appointments);

  return (
    <div className="p-6">

      {/* MENU ENTRE ROTAS */}
      <div className="flex gap-3 mb-6">
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

      {/* TÍTULO */}
      <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8">{title}</h2>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
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
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-400 uppercase">
                  Status
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
                      </div>
                    </td>
                  </tr>

                  {appts.map((appt) => (
                    <tr key={appt.id}>
                      <td className="px-6 py-4 text-white">
                        {appt.clients?.full_name}
                      </td>

                      <td className="px-6 py-4 text-gray-300">
                        {appt.professionals?.name}
                      </td>

                      <td className="px-6 py-4 text-gray-300">
                        {appt.services?.name}
                      </td>

                      <td className="px-6 py-4 text-gray-300">
                        {formatLocalDate(appt.start_time)}
                      </td>

                      <td className="px-6 py-4 text-gray-300">
                        {appt.status}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
