"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";

/* =========================================================
 * Tipos
 * ========================================================= */
interface Client {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  is_blocked?: boolean | null;
  last_appointment?: {
    id: string;
    start_time: string;
    professional: { name: string } | null;
  } | null;
}

/* Helper para iniciais do avatar */
function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal Novo Cliente
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
  });

  /* =========================================================
   * Carregar clientes
   * ========================================================= */
  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("clients")
      .select(
        `
        id,
        full_name,
        phone,
        email,
        created_at,
        is_blocked,
        appointments (
          id,
          start_time,
          professional: professional_id ( name )
        )
      `
      )
      .order("full_name", { ascending: true }); // ordem alfabética

    if (error) {
      console.error("Erro ao carregar clientes:", error);
      setError("Erro ao carregar clientes. Tente novamente mais tarde.");
      setLoading(false);
      return;
    }

    const formatted: Client[] =
      (data ?? []).map((c: any) => ({
        ...c,
        last_appointment: c.appointments?.[0] || null,
      })) || [];

    setClients(formatted);
    setLoading(false);
  }

  /* =========================================================
   * Filtro de busca
   * ========================================================= */
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = c.full_name?.toLowerCase() ?? "";
      const phone = c.phone?.toLowerCase() ?? "";
      const email = c.email?.toLowerCase() ?? "";
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [clients, search]);

  /* =========================================================
   * Excluir cliente (via API)
   * ========================================================= */
  async function handleDeleteClient(id: string) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      const res = await fetch(`/api/clients/${id}/delete`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        alert("Erro ao excluir: " + (data.error ?? "Erro desconhecido"));
        return;
      }

      alert("Cliente excluído com sucesso!");
      await fetchClients();
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao excluir cliente.");
    }
  }

  /* =========================================================
   * Criar cliente (via API)
   * ========================================================= */
  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClient.full_name.trim()) {
      alert("Informe pelo menos o nome completo do cliente.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: newClient.full_name.trim(),
          phone: newClient.phone.trim() || null,
          email: newClient.email.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Erro ao criar cliente:", data);
        alert("Erro ao criar cliente: " + (data.error ?? "Erro desconhecido"));
        setCreating(false);
        return;
      }

      // Resetar formulário
      setNewClient({
        full_name: "",
        phone: "",
        email: "",
      });
      setShowNewModal(false);
      await fetchClients();
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao criar cliente.");
    } finally {
      setCreating(false);
    }
  }

  /* =========================================================
   * Render
   * ========================================================= */

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-[#D6C6AA]">Carregando clientes...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Topo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#D6C6AA]">
            Gerenciar Clientes
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Lista de clientes cadastrados no estúdio.
          </p>
        </div>

        {/* Busca + contador + botão novo */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Campo de busca */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="clientSearchField"
              className="pl-9 pr-3 py-2 rounded-lg bg-gray-900 text-sm text-white border border-gray-700 w-full placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA] focus:ring-1 focus:ring-[#D6C6AA]/70"
            />
          </div>

          {/* Contador de clientes */}
          <span className="text-gray-400 text-sm font-medium whitespace-nowrap">
            {filteredClients.length} cliente
            {filteredClients.length !== 1 ? "s" : ""}
          </span>

          {/* Botão Novo Cliente */}
          <button
            onClick={() => setShowNewModal(true)}
            className="bg-[#D6C6AA] text-black px-4 py-2 rounded-xl font-semibold hover:bg-[#e5d8c2] whitespace-nowrap shadow-sm hover:shadow-md transition"
          >
            + Novo Cliente
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900/70">
            <tr>
              <th className="px-4 py-3 text-gray-300 text-left text-xs font-semibold uppercase tracking-wide">
                Cliente
              </th>
              <th className="px-4 py-3 text-gray-300 text-left text-xs font-semibold uppercase tracking-wide">
                Contato
              </th>
              <th className="px-4 py-3 text-gray-300 text-left text-xs font-semibold uppercase tracking-wide">
                Último Agendamento
              </th>
              <th className="px-4 py-3 text-gray-300 text-left text-xs font-semibold uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-gray-300 text-left text-xs font-semibold uppercase tracking-wide">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-700">
            {filteredClients.map((c) => {
              const initials = getInitials(c.full_name);
              const hasAppointment = !!c.last_appointment;

              let statusLabel = "Sem atividade";
              let statusClasses =
                "bg-slate-700/40 text-slate-200 border-slate-500/40";

              if (c.is_blocked) {
                statusLabel = "Bloqueado";
                statusClasses =
                  "bg-red-900/40 text-red-100 border-red-600/60";
              } else if (hasAppointment) {
                statusLabel = "Ativa";
                statusClasses =
                  "bg-green-900/30 text-green-200 border-green-600/60";
              }

              return (
                <tr
                  key={c.id}
                  className="hover:bg-gray-700/60 group transition-colors"
                >
                  {/* Cliente */}
                  <td className="px-4 py-4 flex items-center gap-3">
                    <div
                      className="
                        w-10 h-10 rounded-full 
                        bg-gradient-to-br from-gray-700 to-gray-900
                        border border-gray-600
                        flex items-center justify-center 
                        text-gray-100 font-bold text-sm
                        shadow-sm
                      "
                    >
                      {initials || "—"}
                    </div>

                    <div>
                      <p className="font-semibold text-white">
                        {c.full_name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Cadastrado em{" "}
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-[11px] text-gray-500 opacity-0 group-hover:opacity-100 transition">
                        ID: {c.id.slice(0, 8)}…
                      </p>
                    </div>
                  </td>

                  {/* Contato */}
                  <td className="px-4 py-4 text-gray-300 text-sm">
                    <p>{c.phone || "—"}</p>
                    <p className="text-xs text-gray-400">{c.email || "—"}</p>
                  </td>

                  {/* Último agendamento */}
                  <td className="px-4 py-4 text-gray-200 text-sm">
                    {c.last_appointment ? (
                      <div>
                        <p>
                          {new Date(
                            c.last_appointment.start_time
                          ).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-gray-400">
                          com {c.last_appointment.professional?.name ?? "—"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic text-sm">Nenhum</p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold border ${statusClasses}`}
                    >
                      {statusLabel}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="
                          px-3 py-1 rounded-lg 
                          bg-blue-900/30 text-blue-300 
                          border border-blue-700/40
                          hover:bg-blue-900/40 hover:text-blue-200
                          transition font-semibold text-[13px]
                        "
                      >
                        INSPECIONAR
                      </Link>

                      <button
                        className="
                          px-3 py-1 rounded-lg 
                          bg-red-900/20 text-red-300
                          border border-red-700/40
                          hover:bg-red-900/30 hover:text-red-200
                          transition font-medium text-[13px]
                        "
                        onClick={() => handleDeleteClient(c.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredClients.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  Nenhum cliente encontrado com esse termo de busca.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Cliente */}
      {showNewModal && (
        <>
          {/* fundo escuro */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90]"
            onClick={() => !creating && setShowNewModal(false)}
          />
          {/* conteúdo */}
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="w-full max-w-lg bg-[#181b24] border border-gray-700 rounded-2xl shadow-2xl p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-[#D6C6AA]">
                    Novo Cliente
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Cadastre rapidamente um novo cliente no estúdio.
                  </p>
                </div>
                <button
                  onClick={() => !creating && setShowNewModal(false)}
                  className="text-gray-400 hover:text-white text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs text-gray-300 mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={newClient.full_name}
                    onChange={(e) =>
                      setNewClient((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA] focus:ring-1 focus:ring-[#D6C6AA]/70"
                    placeholder="Ex: Maria Clara Silva"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={newClient.phone}
                      onChange={(e) =>
                        setNewClient((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      autoComplete="off"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA] focus:ring-1 focus:ring-[#D6C6AA]/70"
                      placeholder="Somente números"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-300 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={(e) =>
                        setNewClient((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      autoComplete="off"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA] focus:ring-1 focus:ring-[#D6C6AA]/70"
                      placeholder="exemplo@cliente.com"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#D6C6AA] text-black hover:bg-[#e5d8c2] disabled:opacity-60 shadow-sm hover:shadow-md transition"
                  >
                    {creating ? "Salvando..." : "Salvar cliente"}
                  </button>
                </div>
              </form>

              <p className="mt-3 text-[11px] text-gray-500">
                * Campos obrigatórios. Você poderá adicionar observações e
                bloqueios diretamente na ficha do cliente.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
