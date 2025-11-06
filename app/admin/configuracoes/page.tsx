
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle,
  XCircle,
  CalendarDays,
  Loader2,
  KeyRound,
  Palette,
  CreditCard,
  Timer,
  Trash2,
  Copy,
  RefreshCw,
  QrCode,
  Link2,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { motion, AnimatePresence } from "framer-motion";

/* ============================================================
 * Tipos
 * ============================================================ */
interface Schedule {
  id?: string;
  day_of_week: string;
  start_time: string | null;       // HH:mm ou null (para "fechado" no estado da UI)
  end_time: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  professional_id?: string | null;
  is_closed?: boolean;             // controle de UI
}

type PaymentPolicy = "none" | "deposit" | "full";
type PaymentMode = "percent" | "fixed";

type TabsKeys = "geral" | "pagamentos" | "horarios" | "seguranca" | "integracoes";

/* ============================================================
 * Constantes
 * ============================================================ */
const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_NAMES: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

/* ============================================================
 * Utils
 * ============================================================ */
function formatTime(time: string | null): string {
  if (!time) return "";
  // se vier "HH:mm:ss", corta pra "HH:mm"
  return time.length >= 5 ? time.slice(0, 5) : time;
}

function clsx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

// Normaliza número de WhatsApp para formato "5599999999999@c.us"
function normalizeWhats(to?: string): string | null {
  if (!to) return null;
  const only = String(to).replace(/\\D/g, "");
  if (!only) return null;
  return only.endsWith("@c.us") ? only : `${only}@c.us`;
}

/**
 * Transforma o array schedules para envio ao backend (NOT NULL friendly).
 * Regras:
 *  - se is_closed = true => envia "00:00" para start_time e end_time
 *  - se is_closed = false => start_time e end_time são obrigatórios; se faltar, retorna erro
 *  - pausas podem ser null
 */
function prepareSchedulesForPersist(raw: Schedule[]): {
  ok: boolean;
  error?: string;
  data?: Array<Required<Pick<Schedule,
    "day_of_week" | "start_time" | "end_time">> & Pick<Schedule,
    "id" | "break_start_time" | "break_end_time" | "professional_id">>;
} {
  const out: any[] = [];

  for (const s of raw) {
    const isClosed = Boolean(s.is_closed);
    if (isClosed) {
      out.push({
        id: s.id,
        day_of_week: s.day_of_week,
        start_time: "00:00",
        end_time: "00:00",
        break_start_time: null,
        break_end_time: null,
        professional_id: s.professional_id ?? null,
      });
    } else {
      if (!s.start_time || !s.end_time) {
        return {
          ok: false,
          error: `Defina "Início" e "Fim" para ${DAY_NAMES[s.day_of_week]} ou marque como fechado.`,
        };
      }
      out.push({
        id: s.id,
        day_of_week: s.day_of_week,
        start_time: formatTime(s.start_time),
        end_time: formatTime(s.end_time),
        break_start_time: s.break_start_time ? formatTime(s.break_start_time) : null,
        break_end_time: s.break_end_time ? formatTime(s.break_end_time) : null,
        professional_id: s.professional_id ?? null,
      });
    }
  }

  return { ok: true, data: out };
}

/* ============================================================
 * Modal Luxo Premium — confirm dialog
 * ============================================================ */
type PremiumConfirmModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function PremiumConfirmModal({
  open,
  title = "Confirmar ação",
  description = "Você tem certeza que deseja continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: PremiumConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className={clsx(
              "relative w-[92%] max-w-lg",
              "rounded-2xl overflow-hidden",
              "shadow-2xl"
            )}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {/* Borda premium com gradiente + brilho */}
            <div className="p-[1px] bg-[linear-gradient(135deg,rgba(214,198,170,0.7),rgba(214,198,170,0.12)_40%,rgba(255,255,255,0)_55%,rgba(214,198,170,0.28)_70%,rgba(214,198,170,0.75))]">
              <div className="relative rounded-2xl bg-[rgba(20,20,20,0.85)] backdrop-blur-xl">
                {/* Glare decorativo */}
                <div className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-[radial-gradient(closest-side,rgba(214,198,170,0.20),rgba(255,255,255,0))] blur-2xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(214,198,170,0.14),rgba(255,255,255,0))] blur-2xl" />

                {/* Cabeçalho */}
                <div className="flex items-start gap-4 p-6">
                  <div className="mt-[2px]">
                    <CalendarDays className="w-6 h-6 text-[#D6C6AA]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white tracking-wide">
                      {title}
                    </h3>
                    <p className="text-sm text-gray-300/90 mt-1.5 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>

                {/* Linha divisória suave */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#d6c6aa33] to-transparent" />

                {/* Ações */}
                <div className="flex items-center justify-end gap-3 p-5">
                  <button
                    onClick={onCancel}
                    className={clsx(
                      "px-4 py-2 rounded-lg text-sm font-medium",
                      "border border-gray-700/70 text-gray-200",
                      "hover:border-gray-600 hover:bg-gray-800/60 transition-colors"
                    )}
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    className={clsx(
                      "px-4 py-2 rounded-lg text-sm font-semibold",
                      "bg-[#D6C6AA] text-black",
                      "hover:brightness-105 transition-all shadow-[0_0_0_1px_rgba(214,198,170,0.25),0_8px_32px_-6px_rgba(214,198,170,0.3)]"
                    )}
                  >
                    {confirmText}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
 * Página
 * ============================================================ */
export default function AdminConfiguracoesPage() {
  // Schedules
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Settings — gerais
  const [systemName, setSystemName] = useState("");
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);

  // Settings — pagamentos
  const [paymentPolicy, setPaymentPolicy] = useState<PaymentPolicy>("full");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("percent");
  const [paymentValue, setPaymentValue] = useState<number>(30);
  const [paymentTimeoutHours, setPaymentTimeoutHours] = useState<number>(2);

  // UI feedback
  const [loading, setLoading] = useState(true);
  const [busySaveGeneral, setBusySaveGeneral] = useState(false);
  const [busySavePolicy, setBusySavePolicy] = useState(false);
  const [busySaveSchedules, setBusySaveSchedules] = useState(false);
  const [busyChangePassword, setBusyChangePassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<TabsKeys>("geral");

  // Modal premium
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState<
    false | { from: string; to: "weekdays" | "weekends" | "all" }
  >(false);

  // Expand de dia na aba horários
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Integrações — WhatsApp
  const [qrDataURL, setQrDataURL] = useState<string | null>(null);
  const [busyQR, setBusyQR] = useState(false);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  /* ---------------------------------------------
   * Carregar dados (mount only)
   * ------------------------------------------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        // schedules
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("schedules")
          .select("*")
          .order("day_of_week", { ascending: true });

        if (scheduleError) throw scheduleError;

        const existing = new Map(scheduleData?.map((s: any) => [s.day_of_week, s]));
        const initialSchedules: Schedule[] = DAYS_OF_WEEK.map((day) => {
          const row = existing.get(day);
          if (row) {
            const closed = (row.start_time === "00:00" || row.start_time === "00:00:00") &&
                           (row.end_time === "00:00" || row.end_time === "00:00:00");
            return {
              id: row.id,
              day_of_week: row.day_of_week,
              start_time: closed ? null : (row.start_time ?? null),
              end_time: closed ? null : (row.end_time ?? null),
              break_start_time: row.break_start_time ?? null,
              break_end_time: row.break_end_time ?? null,
              professional_id: row.professional_id ?? null,
              is_closed: closed,
            };
          }
          return {
            day_of_week: day,
            start_time: "09:00",
            end_time: "18:00",
            break_start_time: null,
            break_end_time: null,
            is_closed: false,
          };
        });
        setSchedules(initialSchedules);

        // settings
        const { data: settingsData, error: settingsError } = await supabase
          .from("settings")
          .select("key, value");

        if (settingsError) throw settingsError;

        const getVal = (k: string, def?: any) =>
          settingsData?.find((s: any) => s.key === k)?.value ?? def;

        setSystemName(getVal("system_name", "Studio Donna Patty"));
        setSystemLogoUrl(getVal("system_logo_url", null));

        setPaymentPolicy(getVal("payment_policy", "full"));
        setPaymentMode(getVal("payment_mode", "percent"));
        setPaymentValue(Number(getVal("payment_value", 30)));
        setPaymentTimeoutHours(Number(getVal("payment_timeout_hours", 2)));
      } catch (err: any) {
        console.error("Erro ao carregar dados de configuração:", err);
        setError("Falha ao carregar dados: " + (err?.message || "erro desconhecido"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------------------------------------
   * Helpers de feedback
   * ------------------------------------------- */
  function info(msg: string) {
    setSuccessMessage(msg);
    setError(null);
  }
  function fail(msg: string) {
    setSuccessMessage(null);
    setError(msg);
  }

  /* ---------------------------------------------
   * Salvar settings (rota /api/settings)
   * ------------------------------------------- */
  async function saveSettings(pairs: Array<{ key: string; value: any }>) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: pairs }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar configurações.");
  }

  /* ---------------------------------------------
   * Handlers: Geral / Pagamentos
   * ------------------------------------------- */
  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setBusySaveGeneral(true);
    try {
      await saveSettings([
        { key: "system_name", value: systemName },
        { key: "system_logo_url", value: systemLogoUrl },
      ]);
      info("Configurações gerais salvas com sucesso!");
    } catch (err: any) {
      console.error(err);
      fail("Falha ao salvar configurações gerais: " + (err?.message || ""));
    } finally {
      setBusySaveGeneral(false);
    }
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    setBusySavePolicy(true);
    try {
      await saveSettings([
        { key: "payment_policy", value: paymentPolicy },
        { key: "payment_mode", value: paymentMode },
        { key: "payment_value", value: paymentValue },
        { key: "payment_timeout_hours", value: paymentTimeoutHours },
      ]);
      info("Política de pagamentos salva com sucesso!");
    } catch (err: any) {
      console.error(err);
      fail("Falha ao salvar política de pagamentos: " + (err?.message || ""));
    } finally {
      setBusySavePolicy(false);
    }
  }

  /* ---------------------------------------------
   * Salvar Horários — rota segura (service_role), sem redirect.
   * Com validação NOT NULL friendly.
   * ------------------------------------------- */
  async function handleSaveSchedules(e: React.FormEvent) {
    e.preventDefault();
    setBusySaveSchedules(true);

    const prepared = prepareSchedulesForPersist(schedules);
    if (!prepared.ok) {
      fail(prepared.error || "Complete os horários antes de salvar.");
      setBusySaveSchedules(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: prepared.data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar horários.");
      info("Horários salvos com sucesso!");
    } catch (err: any) {
      console.error(err);
      fail("Falha ao salvar horários: " + (err?.message || ""));
    } finally {
      setBusySaveSchedules(false);
    }
  }

  /* ---------------------------------------------
   * Alterar senha
   * ------------------------------------------- */
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusyChangePassword(true);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      fail("Preencha todos os campos de senha.");
      setBusyChangePassword(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      fail("A nova senha e a confirmação não coincidem.");
      setBusyChangePassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      info("Senha alterada com sucesso! Você pode precisar fazer login novamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      console.error(err);
      fail("Falha ao mudar a senha: " + (err?.message || ""));
    } finally {
      setBusyChangePassword(false);
    }
  }

  /* ---------------------------------------------
   * Ações rápidas — horários
   * ------------------------------------------- */
  const applyWeekdays = () => {
    setSchedules((prev) =>
      prev.map((s) =>
        ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(s.day_of_week)
          ? { ...s, start_time: "09:00", end_time: "18:00", is_closed: false }
          : s
      )
    );
  };

  const clearAllSchedules = () => {
    setSchedules((prev) =>
      prev.map((s) => ({
        ...s,
        start_time: null,
        end_time: null,
        break_start_time: null,
        break_end_time: null,
        is_closed: false,
      }))
    );
    setClearModalOpen(false);
    info("Horários limpos localmente (clique em Salvar Horários para persistir).");
  };

  const copyToGroup = (srcDay: string, group: "weekdays" | "weekends" | "all") => {
    const base = schedules.find((s) => s.day_of_week === srcDay);
    if (!base) return;

    const groupDays =
      group === "weekdays"
        ? ["monday", "tuesday", "wednesday", "thursday", "friday"]
        : group === "weekends"
        ? ["saturday", "sunday"]
        : DAYS_OF_WEEK;

    setSchedules((prev) =>
      prev.map((s) =>
        (groupDays as readonly string[]).includes(s.day_of_week)
          ? {
              ...s,
              start_time: base.start_time,
              end_time: base.end_time,
              break_start_time: base.break_start_time ?? null,
              break_end_time: base.break_end_time ?? null,
              is_closed: base.is_closed || false,
            }
          : s
      )
    );
  };

  /* ---------------------------------------------
   * Integrações — WhatsApp
   * ------------------------------------------- */
  async function refreshWhatsQR() {
    try {
      setBusyQR(true);
      setQrDataURL(null);

      // verifica status
      const statusRes = await fetch("/api/whatsapp/status");
      if (statusRes.ok) {
        const st = await statusRes.json();
        setIsConnected(Boolean(st.connected));
        setConnectedNumber(st.number || null);
        if (st.connected) {
          info("WhatsApp já conectado.");
          return;
        }
      }

      // busca QR
      const res = await fetch("/api/whatsapp/qr");
      if (!res.ok) {
        fail("QR ainda não disponível. Inicie o bot do WhatsApp para gerar o QR.");
        return;
      }
      const { qr } = await res.json();
      if (!qr) {
        fail("QR vazio. Reinicie o bot para gerar um novo QR.");
        return;
      }

      const QR = await import("qrcode");
      const dataUrl = await QR.toDataURL(qr, { margin: 1, scale: 6 });
      setQrDataURL(dataUrl);
      info("QR atualizado.");
    } catch (e: any) {
      console.error(e);
      fail("Falha ao atualizar QR. Verifique se o bot está rodando.");
    } finally {
      setBusyQR(false);
    }
  }

  async function disconnectWhatsApp() {
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        setIsConnected(false);
        setConnectedNumber(null);
        setQrDataURL(null);
        info("WhatsApp desconectado com sucesso.");
      } else {
        fail("Falha ao desconectar o WhatsApp.");
      }
    } catch (err) {
      console.error(err);
      fail("Erro ao desconectar o WhatsApp.");
    }
  }

  useEffect(() => {
    // Atualiza status ao abrir a aba integrações (ou na montagem)
    (async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (res.ok) {
          const d = await res.json();
          setIsConnected(Boolean(d.connected));
          setConnectedNumber(d.number || null);
        }
      } catch {}
    })();
  }, []);

  /* ---------------------------------------------
   * Render
   * ------------------------------------------- */
  if (loading) {
    return <p className="text-[#D6C6AA] p-6">Carregando configurações...</p>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-5 mb-6">
        <h1 className="text-3xl font-bold text-[#D6C6AA]">Configurações</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Ajuste o sistema, políticas de pagamento, horários, segurança e integrações.
        </p>
      </div>

      {/* Feedback banners */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-green-900/30 text-green-300 border border-green-800/60 rounded-lg px-4 py-3 mb-6 flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-red-900/30 text-red-300 border border-red-800/60 rounded-lg px-4 py-3 mb-6 flex items-center gap-3"
          >
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs header */}
      <div className="flex flex-wrap border-b border-gray-800">
        {[
          { key: "geral", label: "Geral", icon: Palette },
          { key: "pagamentos", label: "Pagamentos", icon: CreditCard },
          { key: "horarios", label: "Horários", icon: CalendarDays },
          { key: "seguranca", label: "Segurança", icon: KeyRound },
          { key: "integracoes", label: "Integrações", icon: Link2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabsKeys)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === (key as TabsKeys)
                ? "border-[#D6C6AA] text-[#D6C6AA]"
                : "border-transparent text-gray-400 hover:text-white"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content wrapper */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md transition-all duration-300 mt-6">
        {/* ======= GERAL ======= */}
        {activeTab === "geral" && (
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome do Sistema</label>
                <input
                  type="text"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Logo do Sistema</label>
                <ImageUpload
                  initialImageUrl={systemLogoUrl}
                  onUploadSuccess={(url) => setSystemLogoUrl(url)}
                  onRemove={() => setSystemLogoUrl(null)}
                  bucketName="images"
                  disabled={busySaveGeneral}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busySaveGeneral}
                className="bg-[#D6C6AA] text-black font-medium px-6 py-2 rounded-lg hover:bg-[#e8d8b4] transition-colors inline-flex items-center gap-2 disabled:opacity-60"
              >
                {busySaveGeneral && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Alterações
              </button>
            </div>
          </form>
        )}

        {/* ======= PAGAMENTOS ======= */}
        {activeTab === "pagamentos" && (
          <form onSubmit={handleSavePolicy} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Modo</label>
                <select
                  value={paymentPolicy}
                  onChange={(e) => setPaymentPolicy(e.target.value as PaymentPolicy)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
                >
                  <option value="none">Sem pagamento antecipado</option>
                  <option value="deposit">Depósito (sinal)</option>
                  <option value="full">Pagamento total</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Cálculo</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  disabled={paymentPolicy !== "deposit"}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 disabled:opacity-50"
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Valor</label>
                <div className="flex">
                  {paymentMode === "fixed" && (
                    <span className="bg-gray-800 px-3 border border-r-0 border-gray-700 rounded-l-md text-gray-400 flex items-center">
                      R$
                    </span>
                  )}
                  <input
                    type="number"
                    min={0}
                    value={paymentValue}
                    onChange={(e) => setPaymentValue(Number(e.target.value))}
                    disabled={paymentPolicy !== "deposit"}
                    className={clsx(
                      "w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 disabled:opacity-50",
                      paymentMode === "fixed" ? "rounded-r-md" : "rounded-md"
                    )}
                  />
                  {paymentMode === "percent" && (
                    <span className="bg-gray-800 px-3 border border-l-0 border-gray-700 rounded-r-md text-gray-400 flex items-center">
                      %
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm text-gray-300 mb-1 flex items-center gap-2">
                  <Timer className="w-4 h-4" /> Tempo limite (horas)
                </label>
                <input
                  type="number"
                  min={0}
                  value={paymentTimeoutHours}
                  onChange={(e) => setPaymentTimeoutHours(Number(e.target.value))}
                  disabled={paymentPolicy === "none"}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busySavePolicy}
                className="bg-[#D6C6AA] text-black font-medium px-6 py-2 rounded-lg hover:bg-[#e8d8b4] transition-colors inline-flex items-center gap-2 disabled:opacity-60"
              >
                {busySavePolicy && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Política
              </button>
            </div>
          </form>
        )}

        {/* ======= HORÁRIOS ======= */}
        {activeTab === "horarios" && (
          <form onSubmit={handleSaveSchedules} className="space-y-4">
            {/* Ações rápidas */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                type="button"
                onClick={applyWeekdays}
                className="px-3 py-2 bg-gray-900/60 backdrop-blur-lg rounded-md border border-gray-700/40 text-gray-200 text-sm hover:bg-gray-800/60 transition-colors inline-flex items-center gap-2"
                title="Aplicar 09:00–18:00 (Seg–Sex)"
              >
                <Timer className="w-4 h-4" />
                Definir horário comercial (Seg–Sex)
              </button>

              <div className="h-5 w-px bg-gray-700/60" />

              <button
                type="button"
                onClick={() => setClearModalOpen(true)}
                className="px-3 py-2 bg-transparent rounded-md border border-red-700/50 text-red-300 text-sm hover:bg-red-900/20 transition-colors inline-flex items-center gap-2"
                title="Limpar todos os horários (local)"
              >
                <Trash2 className="w-4 h-4" />
                Limpar horários
              </button>
            </div>

            {/* Lista de dias */}
            {schedules.map((s) => {
              const isClosed = Boolean(s.is_closed);

              return (
                <div
                  key={s.day_of_week}
                  className={clsx(
                    "bg-gray-900/60 backdrop-blur-lg border border-gray-700/40 rounded-xl shadow-sm overflow-hidden transition-all",
                    isClosed ? "opacity-60" : "opacity-100"
                  )}
                >
                  {/* Header do item */}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDay((prev) => (prev === s.day_of_week ? null : s.day_of_week))
                    }
                    className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
                  >
                    <span className="font-semibold text-white flex items-center gap-2">
                      {DAY_NAMES[s.day_of_week]}
                      {isClosed && (
                        <span className="text-xs text-red-400 font-medium">(Fechado)</span>
                      )}
                    </span>

                    <span className="flex items-center gap-2 text-sm text-gray-400">
                      {!isClosed ? `${formatTime(s.start_time)} – ${formatTime(s.end_time)}` : "—"}
                      <motion.div
                        animate={{ rotate: openDay === s.day_of_week ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </motion.div>
                    </span>
                  </button>

                  {/* Corpo do item */}
                  <AnimatePresence initial={false}>
                    {openDay === s.day_of_week && (
                      <motion.div
                        key={s.day_of_week}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.28, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 space-y-5 border-top border-gray-700/40">
                          {/* Toggle aberto/fechado */}
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-sm text-gray-300 flex items-center gap-2">
                              <CalendarDays className="w-4 h-4" />
                              Dia ativo
                            </label>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!isClosed}
                                onChange={() => {
                                  setSchedules((prev) =>
                                    prev.map((it) =>
                                      it.day_of_week === s.day_of_week
                                        ? it.is_closed
                                          ? {
                                              ...it,
                                              is_closed: false,
                                              start_time: it.start_time ?? "09:00",
                                              end_time: it.end_time ?? "18:00",
                                            }
                                          : {
                                              ...it,
                                              is_closed: true,
                                              start_time: null,
                                              end_time: null,
                                              break_start_time: null,
                                              break_end_time: null,
                                            }
                                        : it
                                    )
                                  );
                                }}
                              />
                              <div className="w-10 h-5 bg-gray-700 rounded-full peer-checked:bg-[#D6C6AA] transition-all" />
                              <span className="ml-2 text-xs text-gray-400">
                                {isClosed ? "Fechado" : "Aberto"}
                              </span>
                            </label>
                          </div>

                          {/* Inputs de horário */}
                          {!isClosed && (
                            <>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { label: "Início", key: "start_time" as const },
                                  { label: "Fim", key: "end_time" as const },
                                  { label: "Pausa Início", key: "break_start_time" as const },
                                  { label: "Pausa Fim", key: "break_end_time" as const },
                                ].map(({ label, key }) => (
                                  <div key={key}>
                                    <label className="block text-sm mb-1 text-gray-400">{label}</label>
                                    <input
                                      type="time"
                                      value={formatTime((s as any)[key]) || ""}
                                      onChange={(e) =>
                                        setSchedules((prev) =>
                                          prev.map((it) =>
                                            it.day_of_week === s.day_of_week
                                              ? { ...it, [key]: e.target.value || null }
                                              : it
                                          )
                                        )
                                      }
                                      className="w-full bg-gray-800/70 border border-gray-700/40 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D6C6AA]"
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* Copiar para grupos */}
                              <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setCopyModalOpen({ from: s.day_of_week, to: "weekdays" })}
                                  className="text-xs text-gray-300 hover:text-[#D6C6AA] transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copiar para dias úteis
                                </button>
                                <span className="text-gray-600">•</span>
                                <button
                                  type="button"
                                  onClick={() => setCopyModalOpen({ from: s.day_of_week, to: "weekends" })}
                                  className="text-xs text-gray-300 hover:text-[#D6C6AA] transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copiar para finais de semana
                                </button>
                                <span className="text-gray-600">•</span>
                                <button
                                  type="button"
                                  onClick={() => setCopyModalOpen({ from: s.day_of_week, to: "all" })}
                                  className="text-xs text-gray-300 hover:text-[#D6C6AA] transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copiar para todos
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Rodapé de ações */}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setClearModalOpen(true)}
                className="px-5 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-[#D6C6AA] transition-all inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Limpar horários
              </button>

              <button
                type="submit"
                disabled={busySaveSchedules}
                className="bg-[#D6C6AA] text-black px-6 py-2 rounded-lg hover:bg-[#e8d8b4] transition-colors font-medium disabled:opacity-60 shadow-md inline-flex items-center gap-2"
              >
                {busySaveSchedules && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Horários
              </button>
            </div>
          </form>
        )}

        {/* ======= SEGURANÇA ======= */}
        {activeTab === "seguranca" && (
          <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Senha Atual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-4 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Nova Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-4 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-4 py-2"
                required
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={busyChangePassword}
                className="bg-[#D6C6AA] text-black font-medium px-6 py-2 rounded-lg hover:bg-[#e8d8b4] transition-colors inline-flex items-center gap-2 disabled:opacity-60"
              >
                {busyChangePassword && <Loader2 className="w-4 h-4 animate-spin" />}
                Mudar Senha
              </button>
            </div>
          </form>
        )}

        {/* ======= INTEGRAÇÕES ======= */}
        {activeTab === "integracoes" && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 backdrop-blur-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <QrCode className="w-6 h-6 text-[#D6C6AA]" />
                <h3 className="text-lg font-semibold text-white">Integração WhatsApp</h3>
              </div>
              <button
                onClick={refreshWhatsQR}
                disabled={busyQR}
                className="px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:text:white hover:border-[#D6C6AA] transition-all inline-flex items-center gap-2"
              >
                {busyQR ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Atualizar
              </button>
            </div>

            {/* Estado: Conectado */}
            {isConnected && (
              <div className="flex flex-col items-center text-center py-8">
                <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
                <p className="text-white font-medium text-lg mb-1">Você está conectado!</p>
                <p className="text-gray-400 text-sm mb-5">
                  Número vinculado: {connectedNumber || "(desconhecido)"}
                </p>
                <button
                  onClick={disconnectWhatsApp}
                  className="px-4 py-2 text-sm rounded-md border border-red-600 text-red-300 hover:bg-red-900/20 transition-all"
                >
                  Desconectar
                </button>
              </div>
            )}

            {/* Estado: QR disponível */}
            {!isConnected && qrDataURL && (
              <div className="flex flex-col items-center justify-center py-8">
                <img src={qrDataURL} alt="QR WhatsApp" className="w-52 h-52 rounded-lg" />
                <p className="text-sm text-gray-400 mt-3">
                  Escaneie o QR pelo seu WhatsApp → Aparelhos Conectados
                </p>
              </div>
            )}

            {/* Estado: Sem QR */}
            {!isConnected && !qrDataURL && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                <XCircle className="w-8 h-8 text-red-400 mb-3" />
                <p className="text-sm mb-4">
                  QR ainda não disponível. Inicie o bot do WhatsApp para gerar o QR.
                </p>
                <button
                  onClick={refreshWhatsQR}
                  className="px-4 py-2 text-sm rounded-md border border-gray-700 hover:border-[#D6C6AA] hover:text-white transition-all"
                >
                  Gerar QR
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Limpar horários */}
      <PremiumConfirmModal
        open={clearModalOpen}
        title="Limpar horários"
        description="Esta ação remove todos os horários configurados nesta tela. Deseja continuar? Você ainda precisará clicar em “Salvar Horários” para persistir no banco."
        confirmText="Limpar"
        cancelText="Voltar"
        onCancel={() => setClearModalOpen(false)}
        onConfirm={clearAllSchedules}
      />

      {/* Modal: Copiar horários */}
      <PremiumConfirmModal
        open={Boolean(copyModalOpen)}
        title="Copiar horários"
        description={
          copyModalOpen
            ? copyModalOpen.to === "all"
              ? `Copiar o horário de ${DAY_NAMES[copyModalOpen.from]} para todos os dias?`
              : copyModalOpen.to === "weekdays"
              ? `Copiar o horário de ${DAY_NAMES[copyModalOpen.from]} para os dias úteis?`
              : `Copiar o horário de ${DAY_NAMES[copyModalOpen.from]} para o fim de semana?`
            : ""
        }
        confirmText="Copiar"
        cancelText="Cancelar"
        onCancel={() => setCopyModalOpen(false)}
        onConfirm={() => {
          if (copyModalOpen) {
            copyToGroup(copyModalOpen.from, copyModalOpen.to);
          }
          setCopyModalOpen(false);
          info("Horários copiados localmente (clique em Salvar Horários para persistir).");
        }}
      />
    </div>
  );
}
