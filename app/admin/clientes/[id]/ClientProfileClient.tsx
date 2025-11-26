"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* =========================================================
 * Tipos
 * ========================================================= */
interface ClientProfile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  notes?: string | null;
  is_blocked?: boolean | null;
}

interface AppointmentDetail {
  id: string;
  start_time: string;
  status: string;
  services?: { name: string | null; price: number | string | null } | null;
  professionals?: { name: string | null } | null;
}

/* Helpers */
function brl(v: number | string | null | undefined) {
  const n =
    typeof v === "number"
      ? v
      : v
      ? Number(v)
      : 0;
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

type Props = {
  clientId: string;
};

/* =========================================================
 * Componente principal (client)
 * ========================================================= */
export default function ClientProfileClient({ clientId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  // =================== LOAD ===================
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        // CLIENTE
        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id, full_name, phone, email, created_at, notes, is_blocked")
          .eq("id", clientId)
          .single();

        if (clientErr) throw clientErr;
        setClient(clientData as ClientProfile);

        // AGENDAMENTOS
        const { data: appts, error: apptErr } = await supabase
          .from("appointments")
          .select(
            `
              id,
              start_time,
              status,
              services:service_id ( name, price ),
              professionals:professional_id ( name )
            `
          )
          .eq("client_id", clientId)
          .order("start_time", { ascending: false });

        if (apptErr) throw apptErr;

        const normalized: AppointmentDetail[] = (appts ?? []).map((a: any) => ({
          ...a,
          services: Array.isArray(a.services)
            ? a.services[0] ?? null
            : a.services ?? null,
          professionals: Array.isArray(a.professionals)
            ? a.professionals[0] ?? null
            : a.professionals ?? null,
        }));

        setAppointments(normalized);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Erro ao carregar dados do cliente");
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  // =================== ACTIONS (VIA API) ===================

  async function handleSaveInfo() {
    if (!client) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: client.phone,
          email: client.email,
          notes: client.notes ?? null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar informações");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Erro ao salvar informações");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBlock() {
    if (!client) return;
    setSaving(true);
    setError(null);

    try {
      const newValue = !client.is_blocked;

      const res = await fetch(`/api/clients/${client.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_blocked: newValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar bloqueio");
      }

      setClient({ ...client, is_blocked: newValue });
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Erro ao atualizar bloqueio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient(id: string) {
    if (!confirm("Tem certeza que quer excluir este cliente?")) return;

    try {
      const res = await fetch(`/api/clients/${id}/delete`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        alert("Erro ao excluir: " + data.error);
        return;
      }

      alert("Cliente excluído com sucesso!");
      router.push("/admin/clientes");
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao excluir cliente.");
    }
  }

  // =================== RENDER ===================

  if (loading || !client) {
    return (
      <div className="p-6">
        <p className="text-[#D6C6AA]">Carregando ficha do cliente...</p>
      </div>
    );
  }

  const lastAppointment = appointments[0];
  const totalAppointments = appointments.length;
  const firstAppointment = appointments[appointments.length - 1];

  return (
    <div className="p-6 space-y-6">
      {/* Topo / breadcrumb */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push("/admin/clientes")}
            className="text-sm text-gray-400 hover:text-gray-200 mb-1"
          >
            ← Voltar para lista de clientes
          </button>
          <h1 className="text-3xl font-bold text-[#D6C6AA]">
            Perfil do Cliente
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Ficha completa, histórico de agendamentos e observações.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              window.open(`https://wa.me/55${client.phone ?? ""}`, "_blank")
            }
            className="px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-500/40 text-sm font-semibold hover:bg-green-600/30"
          >
            WhatsApp
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA – Dados + notas + risco */}
        <div className="xl:col-span-1 space-y-4">
          {/* Card de dados básicos */}
          <div className="bg-[#1c212c] rounded-2xl border border-gray-700 p-6 shadow-xl">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-full bg-[#313948] flex items-center justify-center text-2xl font-bold text-white">
                {client.full_name
                  .split(" ")
                  .filter(Boolean)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
              </div>

              <div>
                <p className="text-xl text-[#D6C6AA] font-semibold">
                  {client.full_name}
                </p>
                <p className="text-xs text-gray-400">
                  Cliente desde{" "}
                  {new Date(client.created_at).toLocaleDateString("pt-BR")}
                </p>
                {client.is_blocked && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-[11px] rounded-full bg-red-800/60 text-red-100 border border-red-600/70">
                    Cliente bloqueado
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-400 text-xs mb-1">
                  Telefone
                </label>
                <input
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  value={client.phone ?? ""}
                  onChange={(e) =>
                    setClient({ ...client, phone: e.target.value })
                  }
                  placeholder="Telefone"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">
                  E-mail
                </label>
                <input
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  value={client.email ?? ""}
                  onChange={(e) =>
                    setClient({ ...client, email: e.target.value })
                  }
                  placeholder="E-mail"
                />
              </div>

              {/* mini stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="bg-gray-900/60 rounded-xl px-3 py-2">
                  <p className="text-gray-400">Agendamentos</p>
                  <p className="text-[#D6C6AA] font-semibold text-sm">
                    {totalAppointments}
                  </p>
                </div>
                <div className="bg-gray-900/60 rounded-xl px-3 py-2">
                  <p className="text-gray-400">Primeiro agendamento</p>
                  <p className="text-[#D6C6AA] font-semibold text-[11px]">
                    {firstAppointment
                      ? new Date(
                          firstAppointment.start_time
                        ).toLocaleDateString("pt-BR")
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-3">
                <button
                  onClick={handleSaveInfo}
                  disabled={saving}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#D6C6AA] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>

                <button
                  onClick={handleToggleBlock}
                  disabled={saving}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                    client.is_blocked
                      ? "bg-red-900/40 border-red-600 text-red-200"
                      : "bg-yellow-900/30 border-yellow-600 text-yellow-100"
                  }`}
                >
                  {client.is_blocked
                    ? "Desbloquear cliente"
                    : "Bloquear cliente"}
                </button>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="bg-[#1c212c] rounded-2xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-[#D6C6AA] mb-2">
              Informações importantes
            </h2>
            <p className="text-[11px] text-gray-500 mb-2">
              Use este campo para registrar alergias, preferências, alertas ou
              qualquer detalhe relevante sobre o atendimento.
            </p>

            <textarea
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              value={client.notes ?? ""}
              onChange={(e) =>
                setClient({ ...client, notes: e.target.value })
              }
              placeholder="Ex: Alergia à progressiva X, prefere lavar cabelo com água morna..."
            />

            <div className="flex justify-end mt-2">
              <button
                onClick={handleSaveInfo}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-[#D6C6AA] hover:bg-gray-700 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar observações"}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-[#25161a] rounded-2xl border border-red-800 p-5">
            <h3 className="text-sm font-semibold text-red-200 mb-2">
              Zona de risco
            </h3>
            <p className="text-[11px] text-red-100 mb-3">
              A exclusão remove o cliente e pode afetar relatórios e históricos.
            </p>
            <button
              onClick={() => handleDeleteClient(client.id)}
              className="w-full px-3 py-2 rounded-lg bg-red-700 text-sm font-semibold text-white hover:bg-red-800"
            >
              Excluir cliente
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA – Agendamentos */}
        <div className="xl:col-span-2 space-y-4">
          {/* Último agendamento */}
          <div className="bg-[#1c212c] rounded-2xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-[#D6C6AA] mb-3">
              Último agendamento
            </h2>

            {!lastAppointment ? (
              <p className="text-sm text-gray-400">
                Nenhum agendamento encontrado para este cliente.
              </p>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-[#D6C6AA] text-base font-semibold">
                    {lastAppointment.services?.name ??
                      "Serviço não informado"}
                  </p>
                  <p className="text-sm text-gray-300">
                    Profissional:{" "}
                    {lastAppointment.professionals?.name ?? "Não informado"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(
                      lastAppointment.start_time
                    ).toLocaleString("pt-BR")}
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <p className="text-sm text-gray-300">
                    Valor:{" "}
                    <span className="font-semibold text-[#D6C6AA]">
                      {brl(lastAppointment.services?.price ?? 0)}
                    </span>
                  </p>

                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      lastAppointment.status === "confirmed"
                        ? "bg-green-700/40 text-green-100"
                        : lastAppointment.status === "cancelled"
                        ? "bg-red-700/40 text-red-100"
                        : "bg-yellow-700/40 text-yellow-100"
                    }`}
                  >
                    {lastAppointment.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Lista completa de agendamentos */}
          <div className="bg-[#1c212c] rounded-2xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#D6C6AA]">
                Todos os agendamentos
              </h2>
              <span className="text-[11px] text-gray-500">
                {appointments.length} registro(s)
              </span>
            </div>

            {appointments.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum agendamento encontrado.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {appointments.map((a) => {
                  const date = new Date(a.start_time);

                  const statusBadge =
                    a.status === "confirmed"
                      ? "bg-green-700/40 text-green-100"
                      : a.status === "cancelled"
                      ? "bg-red-700/40 text-red-100"
                      : "bg-yellow-700/40 text-yellow-100";

                  return (
                    <div
                      key={a.id}
                      className="bg-[#242b38] border border-gray-700 rounded-xl px-4 py-3 flex items-start justify-between gap-3 hover:bg-[#2a3241] transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#D6C6AA]">
                          {a.services?.name ?? "Serviço não informado"}
                        </p>
                        <p className="text-xs text-gray-300">
                          Profissional:{" "}
                          {a.professionals?.name ?? "Não informado"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {date.toLocaleDateString("pt-BR")} •{" "}
                          {date.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="text-right text-xs space-y-1">
                        <p className="text-gray-300">
                          {brl(a.services?.price ?? 0)}
                        </p>
                        <span
                          className={`inline-block px-2 py-1 rounded-full font-semibold ${statusBadge}`}
                        >
                          {a.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
