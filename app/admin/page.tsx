"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboardPage() {
  const [pendingAppointments, setPendingAppointments] = useState(0);
  const [confirmedAppointments, setConfirmedAppointments] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [totalServices, setTotalServices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch pending appointments
        const { count: pendingCount, error: pendingError } = await supabase
          .from('appointments')
          .select('id', { count: 'exact' })
          .eq('status', 'pending');
        if (pendingError) throw pendingError;
        setPendingAppointments(pendingCount || 0);

        // Fetch confirmed appointments
        const { count: confirmedCount, error: confirmedError } = await supabase
          .from('appointments')
          .select('id', { count: 'exact' })
          .eq('status', 'confirmed');
        if (confirmedError) throw confirmedError;
        setConfirmedAppointments(confirmedCount || 0);

        // Fetch total clients
        const { count: clientsCount, error: clientsError } = await supabase
          .from('clients')
          .select('id', { count: 'exact' });
        if (clientsError) throw clientsError;
        setTotalClients(clientsCount || 0);

        // Fetch total services
        const { count: servicesCount, error: servicesError } = await supabase
          .from('services')
          .select('id', { count: 'exact' });
        if (servicesError) throw servicesError;
        setTotalServices(servicesCount || 0);

      } catch (err: any) {
        console.error("Erro ao carregar dados do dashboard:", err);
        setError("Falha ao carregar dados do dashboard: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-[#D6C6AA] text-lg">Carregando dados do Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card de Agendamentos Pendentes */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Agendamentos Pendentes</h3>
          <p className="text-4xl font-bold text-[#D6C6AA]">{pendingAppointments}</p>
        </div>

        {/* Card de Agendamentos Confirmados */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Agendamentos Confirmados</h3>
          <p className="text-4xl font-bold text-green-500">{confirmedAppointments}</p>
        </div>

        {/* Card de Total de Clientes */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Total de Clientes</h3>
          <p className="text-4xl font-bold text-blue-500">{totalClients}</p>
        </div>

        {/* Card de Total de Serviços */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Total de Serviços</h3>
          <p className="text-4xl font-bold text-purple-500">{totalServices}</p>
        </div>
      </div>

      {/* Futuras seções de gráficos ou listas recentes */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-gray-300 mb-4">Atividade Recente</h3>
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-400">Lista de agendamentos recentes ou outras métricas...</p>
        </div>
      </div>
    </div>
  );
}
