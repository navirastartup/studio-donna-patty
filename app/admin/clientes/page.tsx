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

export default function AdminClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Erro ao buscar clientes:", error);
      setError(error.message);
    } else {
      setClients(data);
    }
    setLoading(false);
  }

  if (loading) return <p className="text-[#D6C6AA]">Carregando clientes...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8">Gerenciar Clientes</h2>

      {clients.length === 0 ? (
        <p className="text-gray-400">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome Completo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Telefone</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">E-mail</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cadastrado Em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{client.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{client.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{client.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(client.created_at).toLocaleDateString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
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
