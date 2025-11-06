"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at: string;
}

interface Appointment {
  id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function AdminClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: "", phone: "", email: "" });

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setClients(data);
    setLoading(false);
  }

  async function handleDeleteClient(id: string) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  }

  async function handleDeleteAll() {
    if (!confirm("Tem certeza que deseja excluir TODOS os clientes?")) return;
    await supabase.from("clients").delete().neq("id", ""); // Deleta todos
    fetchClients();
  }

  async function handleAddClient() {
    if (!newClient.full_name || !newClient.email) {
      alert("Preencha nome e e-mail.");
      return;
    }
    const { error } = await supabase.from("clients").insert([newClient]);
    if (error) alert("Erro ao adicionar cliente: " + error.message);
    else {
      setNewClient({ full_name: "", phone: "", email: "" });
      setShowForm(false);
      fetchClients();
    }
  }

  async function fetchClientHistory(clientId: string) {
    setSelectedClient(clients.find((c) => c.id === clientId) || null);
    const { data, error } = await supabase
      .from("appointments")
      .select("id, service_id, start_time, end_time, status")
      .eq("client_id", clientId)
      .order("start_time", { ascending: false });
    if (error) alert("Erro ao buscar histórico: " + error.message);
    else setAppointments(data);
  }

  if (loading) return <p className="text-[#D6C6AA]">Carregando clientes...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">Gerenciar Clientes</h2>
        <div className="space-x-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg hover:bg-[#e5d8c2]"
          >
            {showForm ? "Cancelar" : "Novo Cliente"}
          </button>
          <button
            onClick={handleDeleteAll}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Excluir Todos
          </button>
        </div>
      </div>

      {/* FORM DE CADASTRO */}
      {showForm && (
        <div className="bg-gray-800 p-4 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Nome Completo"
            value={newClient.full_name}
            onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
            className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
          />
          <input
            type="text"
            placeholder="Telefone"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
          />
          <input
            type="email"
            placeholder="E-mail"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
          />
          <button
            onClick={handleAddClient}
            className="w-full bg-[#D6C6AA] text-black px-4 py-2 rounded-lg hover:bg-[#e5d8c2]"
          >
            Salvar Cliente
          </button>
        </div>
      )}

      {/* LISTAGEM DE CLIENTES */}
      <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">E-mail</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Cadastrado</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-700">
                <td className="px-6 py-4 text-sm text-white">{client.full_name}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{client.phone}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{client.email}</td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {new Date(client.created_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-6 py-4 flex space-x-2">
                  <button
                    onClick={() => fetchClientHistory(client.id)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Histórico
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HISTÓRICO DE AGENDAMENTOS */}
      {selectedClient && (
        <div className="bg-gray-800 p-6 rounded-lg mt-6">
          <h3 className="text-xl font-semibold text-[#D6C6AA] mb-3">
            Histórico de {selectedClient.full_name}
          </h3>
          {appointments.length === 0 ? (
            <p className="text-gray-400">Nenhum agendamento encontrado.</p>
          ) : (
            <ul className="space-y-2">
              {appointments.map((a) => (
                <li key={a.id} className="text-gray-300">
                  {new Date(a.start_time).toLocaleString("pt-BR")} — {a.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
