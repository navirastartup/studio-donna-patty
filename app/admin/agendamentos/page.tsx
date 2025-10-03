"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'paid' | 'failed';
  // Propriedades relacionais (virão de joins)
  services: { name: string; price: number; };
  professionals: { name: string; specialty: string; };
  clients: { full_name: string; phone: string; email: string; };
}

export default function AdminAgendamentosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all', 'pending', 'confirmed', 'cancelled', 'completed'

  useEffect(() => {
    fetchAppointments();
  }, [filterStatus]);

  async function fetchAppointments() {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        payment_status,
        services (name, price),
        professionals (name, specialty),
        clients (full_name, phone, email)
      `)
      .order('start_time', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar agendamentos:", error);
      setError(error.message);
    } else {
      setAppointments(data as Appointment[]);
    }
    setLoading(false);
  }

  const updateAppointmentStatus = async (id: string, newStatus: Appointment['status']) => {
    setError(null);
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error("Erro ao atualizar status:", error);
      setError(error.message);
    } else {
      fetchAppointments(); // Recarrega os agendamentos
    }
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-500';
      case 'confirmed': return 'text-green-500';
      case 'cancelled': return 'text-red-500';
      case 'completed': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando agendamentos...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8">Gerenciar Agendamentos</h2>

      {/* Filtros de Status */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors
            ${filterStatus === 'all' ? 'bg-[#D6C6AA] text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors
            ${filterStatus === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setFilterStatus('confirmed')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors
            ${filterStatus === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Confirmados
        </button>
        <button
          onClick={() => setFilterStatus('cancelled')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors
            ${filterStatus === 'cancelled' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Cancelados
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors
            ${filterStatus === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Concluídos
        </button>
      </div>

      {appointments.length === 0 ? (
        <p className="text-gray-400">Nenhum agendamento encontrado para este status.</p>
      ) : (
        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cliente</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Profissional</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Serviço</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data e Hora</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pagamento</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{appt.clients?.full_name}</div>
                    <div className="text-sm text-gray-400">{appt.clients?.email}</div>
                    <div className="text-sm text-gray-500">{appt.clients?.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{appt.professionals?.name}</div>
                    <div className="text-sm text-gray-400">{appt.professionals?.specialty}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{appt.services?.name}</div>
                    <div className="text-sm text-gray-400">R$ {appt.services?.price?.toFixed(2).replace('.', ',')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(appt.start_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${getStatusColor(appt.status)}`}>
                      {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {appt.payment_status.charAt(0).toUpperCase() + appt.payment_status.slice(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => alert("Visualizar detalhes do agendamento " + appt.id)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="Ver Detalhes"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {appt.status === 'pending' && (
                        <button
                          onClick={() => updateAppointmentStatus(appt.id, 'confirmed')}
                          className="text-green-500 hover:text-green-700 transition-colors"
                          title="Confirmar Agendamento"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      {appt.status === 'pending' && (
                        <button
                          onClick={() => updateAppointmentStatus(appt.id, 'cancelled')}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Cancelar Agendamento"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                      {(appt.status === 'confirmed' || appt.status === 'pending') && (
                        <button
                          onClick={() => updateAppointmentStatus(appt.id, 'completed')}
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          title="Marcar como Concluído"
                        >
                          <Clock className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
