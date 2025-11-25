import React, { useState } from "react";
import type { RowUI } from "@/src/types/RowUI";


interface PaymentDetailsModalProps {
  payment: RowUI | null;
  onClose: () => void;
onEdit: (payment: RowUI) => void | Promise<void>;
onCancel: (paymentId: string) => void | Promise<void>;
onDelete: (paymentId: string) => void | Promise<void>;
onRefund?: (paymentId: string) => void | Promise<void>;
}

/** Avatar com fallback em iniciais */
function Avatar({
  name,
  src,
  size = 40,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  const initials = (name || "—")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-gray-800 text-gray-300"
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.45) }}
      >
        {initials || "—"}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name || "avatar"}
      width={size}
      height={size}
      className="rounded-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = "";
      }}
    />
  );
}

const formatDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatCurrency = (v: number) =>
  `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;

export default function PaymentDetailsModal({
  payment,
  onClose,
  onEdit,
  onCancel,
  onDelete,
  onRefund,
}: PaymentDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(
    payment ? Number(payment.amount).toFixed(2) : "0,00"
  );
const [editMethod, setEditMethod] = useState(payment?.method ?? "Outro");
const [editStatus, setEditStatus] = useState(payment?.status ?? "pending");


  if (!payment) return null;

  const normalizedStatus = payment.status?.toString().toLowerCase() ?? "";
  const isCancelled = normalizedStatus === "cancelled" || normalizedStatus === "cancelado";
  const isApproved =
    normalizedStatus === "approved" ||
    normalizedStatus === "aprovado" ||
    normalizedStatus === "paid";
  const isPending =
    normalizedStatus === "pending" ||
    normalizedStatus === "pendente" ||
    normalizedStatus === "aguardando";

  const statusBadgeClass = isApproved
    ? "bg-green-700/50 text-green-100 border border-green-500/60"
    : isPending
    ? "bg-yellow-700/40 text-yellow-100 border border-yellow-500/60"
    : isCancelled
    ? "bg-gray-700/60 text-gray-200 border border-gray-500/60"
    : "bg-red-700/50 text-red-100 border border-red-500/60";

  const statusLabel = isApproved
    ? "Aprovado"
    : isPending
    ? "Pendente"
    : isCancelled
    ? "Cancelado"
    : payment.status ?? "Indefinido";

const handleSaveEdit = () => {
  const num = Number(editAmount.replace(",", "."));

  const updated: RowUI = {
    ...payment,
    amount: num,
    method: editMethod || payment.method,
    status: editStatus || payment.status,
  };

  onEdit(updated);

  // atualização instantânea no modal
  payment.amount = updated.amount;
  payment.status = updated.status;
  payment.method = updated.method;

  setIsEditing(false);
};


 return (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
    onClick={onClose} // ← fecha ao clicar fora
  >
    <div
      className="bg-gradient-to-br from-gray-950 via-gray-900 to-black p-6 rounded-2xl border border-gray-700/70 w-full max-w-2xl shadow-2xl"
      onClick={(e) => e.stopPropagation()} // ← impede fechar ao clicar dentro
    >

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
              Detalhes do pagamento
            </p>
            <h2 className="text-2xl font-semibold text-[#D6C6AA] mt-1">
              {payment.serviceName ?? "Serviço não informado"}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Origem:{" "}
              <span className="text-gray-300 font-medium">
                {payment.origin === "appointment" ? "Agendamento" : "Cadastro manual"}
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}`}
            >
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-100 transition"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Linha cliente / profissional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="flex items-center gap-3 rounded-xl bg-gray-900/70 border border-gray-800 px-3 py-3">
            <Avatar name={payment.clientName} src={payment.clientImage ?? undefined} />
            <div className="flex flex-col">
              <span className="text-[11px] uppercase text-gray-500 tracking-wide">
                Cliente
              </span>
              <span className="text-sm font-medium text-gray-100">
                {payment.clientName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-gray-900/70 border border-gray-800 px-3 py-3">
            <Avatar
              name={payment.professionalName ?? "Sem profissional"}
              src={payment.professionalImage ?? undefined}
            />
            <div className="flex flex-col">
              <span className="text-[11px] uppercase text-gray-500 tracking-wide">
                Profissional
              </span>
              <span className="text-sm font-medium text-gray-100">
                {payment.professionalName ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Infos principais + valores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Coluna 1 - infos gerais */}
          <div className="rounded-xl bg-gray-900/80 border border-gray-800 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Serviço</span>
              <span className="text-gray-100 font-medium">
                {payment.serviceName ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Método</span>
              <span className="text-gray-100 font-medium">
                {payment.method ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Origem</span>
              <span className="text-gray-100 font-medium">
                {payment.origin === "appointment" ? "Agendamento" : "Manual"}
              </span>
            </div>
          </div>

          {/* Coluna 2 - valores + datas */}
          <div className="rounded-xl bg-gray-900/80 border border-gray-800 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Valor</span>
              <span className="text-[#D6C6AA] font-semibold text-base">
                {formatCurrency(payment.amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data do pagamento</span>
              <span className="text-gray-100 font-medium">
                {formatDateTime(payment.dateISO)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Horário do serviço</span>
              <span className="text-gray-100 font-medium">
                {formatDateTime(payment.appointmentStart)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Conclusão / registro</span>
              <span className="text-gray-100 font-medium">
                {formatDateTime(payment.appointmentEnd ?? payment.dateISO)}
              </span>
            </div>
          </div>
        </div>

       <div className="mb-5">
  <p className="text-xs font-semibold text-[#D6C6AA] mb-2 uppercase tracking-wide">
    Histórico do serviço
  </p>

  {/* AFASTAMOS MAIS O TEXTO PARA A DIREITA */}
  <div className="relative pl-8 border-l border-gray-700 space-y-4 text-xs">

    {/* --- ITEM 1 --- */}
    <div className="relative leading-tight">
      {/* BOLINHA MAIS À ESQUERDA */}
      <span className="absolute -left-4 top-[2px] w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-500" />
      <p className="text-gray-200 font-medium">Agendamento criado</p>
      <p className="text-gray-500 mt-[1px]">
        {formatDateTime(payment.appointmentStart ?? payment.dateISO)}
      </p>
    </div>

    {/* --- PENDENTE --- */}
    {isPending && (
      <div className="relative leading-tight">
        <span className="absolute -left-4 top-[2px] w-3.5 h-3.5 rounded-full bg-yellow-500 border border-yellow-200 shadow" />
        <p className="text-gray-200 font-medium">Pagamento pendente</p>
        <p className="text-gray-500 mt-[1px]">
          Registro criado em {formatDateTime(payment.dateISO)}
        </p>
      </div>
    )}

    {/* --- APROVADO --- */}
    {isApproved && (
      <div className="relative leading-tight">
        <span className="absolute -left-4 top-[2px] w-3.5 h-3.5 rounded-full bg-green-500 border border-green-200 shadow" />
        <p className="text-gray-200 font-medium">Pagamento aprovado</p>
        <p className="text-gray-500 mt-[1px]">
          Confirmado em {formatDateTime(payment.dateISO)}
        </p>
      </div>
    )}

    {/* --- CANCELADO --- */}
    {isCancelled && (
      <div className="relative leading-tight">
        <span className="absolute -left-4 top-[2px] w-3.5 h-3.5 rounded-full bg-gray-500 border border-gray-300 shadow" />
        <p className="text-gray-200 font-medium">Pagamento cancelado</p>
        <p className="text-gray-500 mt-[1px]">
          Cancelado em {formatDateTime(payment.dateISO)}
        </p>
      </div>
    )}
  </div>
</div>


        {/* Modo edição rápida */}
        {isEditing && (
          <div className="mb-5 rounded-xl bg-black/40 border border-gray-800 px-4 py-3">
            <p className="text-xs text-gray-400 mb-3">
              Editar informações principais do pagamento.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-gray-400">Valor</label>
                <input
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-100 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-400">Método</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-100 text-xs"
                >
                  <option value="">—</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-400">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-100 text-xs"
                >
                  <option value={normalizedStatus}>{statusLabel}</option>
                  <option value="approved">Aprovado</option>
                  <option value="pending">Pendente</option>
                  <option value="failed">Falhou</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 rounded-lg bg-gray-800 text-xs text-gray-200"
              >
                Cancelar edição
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 rounded-lg bg-[#D6C6AA] text-xs text-black font-semibold"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4 pt-3 border-t border-gray-800">
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-gray-800 text-xs text-gray-200 hover:bg-gray-700"
              onClick={onClose}
            >
              Fechar
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-yellow-500/90 text-xs text-black font-semibold hover:bg-yellow-400"
              onClick={() => setIsEditing((v) => !v)}
            >
              {isEditing ? "Cancelar edição" : "Editar pagamento"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
<button
  className="px-4 py-2 rounded-lg bg-orange-600/90 text-xs text-black font-semibold hover:bg-orange-500"
  onClick={() => onCancel?.(payment.id)}   // ← com OPTIONAL CHAIN
>
  Cancelar pagamento
</button>

<button
  className="px-4 py-2 rounded-lg bg-red-600/90 text-xs text-black font-semibold hover:bg-red-500"
  onClick={() => onDelete?.(payment.id)}   // ← com OPTIONAL CHAIN
>
  Excluir pagamento
</button>
          </div>
        </div>
      </div>
    </div>
  );
}
