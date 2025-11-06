"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Service = { 
  id: string; 
  name: string; 
  price: number; 
  duration_minutes?: number | null;
};
type Professional = { 
  id: string; 
  name: string; 
  specialty?: string | null; 
  image_url?: string | null;
};
type Schedule = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  break_start_time?: string | null;
  break_end_time?: string | null;
  professional_id?: string | null;
};

const ptWeek = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function NovoAgendamentoPage() {
  const router = useRouter();

  // dados base
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // form
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [payMethod, setPayMethod] = useState<"Pix" | "Cartão" | "Dinheiro" | "Outro" | "">("");
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [searching, setSearching] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // horários já ocupados
  const [bookedTimes, setBookedTimes] = useState<{ start: string; end: string }[]>([]);

  // carregar dados base
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: s1 }, { data: s2 }, { data: s3 }] = await Promise.all([
          supabase.from("services").select("id, name, price, duration_minutes").order("name"),
          supabase.from("professionals").select("id, name, specialty, image_url").order("name"),
          supabase.from("schedules").select("*"),
        ]);
        setServices((s1 ?? []) as Service[]);
        setProfessionals((s2 ?? []) as Professional[]);
        setSchedules((s3 ?? []) as Schedule[]);
      } catch (err: any) {
        setError(err.message || "Falha ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // buscar agendamentos existentes do profissional
  useEffect(() => {
    (async () => {
      if (!professionalId || !dateStr) return;
      try {
        const startOfDay = `${dateStr}T00:00:00`;
        const endOfDay = `${dateStr}T23:59:59`;

        const { data, error } = await supabase
          .from("appointments")
          .select("start_time, end_time")
          .eq("professional_id", professionalId)
          .gte("start_time", startOfDay)
          .lte("end_time", endOfDay);

        if (error) throw error;

        const booked = (data ?? []).map((a) => {
          const start = new Date(a.start_time);
          const end = new Date(a.end_time);
          const toLocalTime = (d: Date) => {
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
            return local.toISOString().slice(11, 16);
          };
          return { start: toLocalTime(start), end: toLocalTime(end) };
        });

        setBookedTimes(booked);
      } catch (err: any) {
        console.error("Erro ao buscar agendamentos:", err?.message || err);
        setError("Falha ao buscar agendamentos do profissional.");
      }
    })();
  }, [professionalId, dateStr]);

  // gerar horários disponíveis
  const timeSlots = useMemo(() => {
    if (!dateStr || !professionalId) return [];

    const date = new Date(dateStr + "T00:00:00");
    const dow = ptWeek[date.getDay()];
    const mapPTtoEN: Record<string, string> = {
      domingo: "sunday",
      segunda: "monday",
      terça: "tuesday",
      quarta: "wednesday",
      quinta: "thursday",
      sexta: "friday",
      sábado: "saturday",
    };
    const dowEn = mapPTtoEN[dow];

    const sc = schedules.find(
      (s) =>
        s.day_of_week.toLowerCase() === dowEn &&
        (!s.professional_id || s.professional_id === professionalId)
    );
    if (!sc) return [];

    const start = parseInt(sc.start_time.slice(0, 2), 10);
    const end = parseInt(sc.end_time.slice(0, 2), 10);
    const bS = sc.break_start_time ? parseInt(sc.break_start_time.slice(0, 2), 10) : -1;
    const bE = sc.break_end_time ? parseInt(sc.break_end_time.slice(0, 2), 10) : -1;

    const srv = services.find((s) => s.id === serviceId);
    const duration = srv?.duration_minutes || 60;
    const step = duration >= 60 ? 60 : 30;

    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const arr: string[] = [];
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += step) {
        const hourStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const currentMinutes = toMinutes(hourStr);

        if (h >= bS && h < bE) continue;

        const conflicts = bookedTimes.some((b) => {
          const startMin = toMinutes(b.start);
          const endMin = toMinutes(b.end);
          const slotEnd = currentMinutes + duration;
          return (
            (currentMinutes >= startMin && currentMinutes < endMin) ||
            (slotEnd > startMin && slotEnd <= endMin) ||
            (currentMinutes <= startMin && slotEnd >= endMin)
          );
        });

        if (conflicts) continue;
        arr.push(hourStr);
      }
    }

    return arr;
  }, [dateStr, professionalId, schedules, bookedTimes, serviceId, services]);

  // 🔍 Busca com debounce + ícone de carregamento
  const handleClientNameChange = (value: string) => {
    setClientName(value);
    if (debounceTimer) clearTimeout(debounceTimer);

    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    setSearching(true);

    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone, email")
        .ilike("full_name", `%${value}%`)
        .limit(5);

      setSearching(false);
      if (!error) setSuggestions(data || []);
    }, 300);

    setDebounceTimer(timer);
  };

  // salvar agendamento
  async function handleSave() {
    setError(null);
    if (!serviceId || !professionalId || !dateStr || !timeStr || !clientName || !clientEmail) {
      setError("Preencha serviço, profissional, data, horário e dados do cliente.");
      return;
    }

    setSaving(true);
    try {
      let clientId: string | null = null;
      const { data: foundClient } = await supabase
        .from("clients")
        .select("id")
        .or(`email.eq.${clientEmail},phone.eq.${clientPhone}`)
        .limit(1)
        .maybeSingle();

      if (foundClient?.id) clientId = foundClient.id;
      else {
        const { data: newClient, error: cErr } = await supabase
          .from("clients")
          .insert([{ full_name: clientName, email: clientEmail, phone: clientPhone }])
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = newClient.id;
      }

      const srv = services.find((s) => s.id === serviceId);
      const duration = srv?.duration_minutes || 60;
      const [hh, mm] = timeStr.split(":");
      const start = new Date(`${dateStr}T${hh}:${mm}:00`);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const amount = srv?.price ?? 0;

      const res = await fetch("/api/appointments/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment: {
            service_id: serviceId,
            professional_id: professionalId,
            client_id: clientId,
            client_email: clientEmail,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: "confirmed",
            payment_status: isPaid ? "pago" : "pendente",
            notes,
          },
          payment: isPaid ? { amount, method: payMethod } : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar agendamento.");

      router.push("/admin/agendamentos?novo=ok");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <CalendarDays className="w-6 h-6 text-[#D6C6AA]" />
        <h1 className="text-2xl md:text-3xl font-bold text-[#D6C6AA]">Agendar manualmente</h1>
      </div>

      {loading ? (
        <p className="text-[#D6C6AA]">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal */}
          <section className="lg:col-span-2 space-y-6">
            {/* Serviço */}
            <div className="bg-gray-900 rounded-xl p-5">
              <label className="block text-sm text-gray-400 mb-2">Serviço</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full bg-gray-800 rounded-lg p-3"
              >
                <option value="">Selecione</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — R$ {s.price.toFixed(2).replace(".", ",")}
                  </option>
                ))}
              </select>
            </div>

            {/* Profissional */}
            <div className="bg-gray-900 rounded-xl p-5">
              <label className="block text-sm text-gray-400 mb-2">Profissional</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {professionals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProfessionalId(p.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      professionalId === p.id
                        ? "border-[#D6C6AA] bg-gray-800"
                        : "border-gray-700 hover:bg-gray-800"
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                      ) : null}
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.specialty || "—"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data e horário */}
            <div className="bg-gray-900 rounded-xl p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Data</label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => {
                      setDateStr(e.target.value);
                      setTimeStr("");
                    }}
                    className="w-full bg-gray-800 rounded-lg p-3"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Horário
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {timeSlots.length === 0 && (
                      <span className="text-gray-500 text-sm">
                        Selecione data e profissional.
                      </span>
                    )}
                    {timeSlots.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTimeStr(t)}
                        className={`px-3 py-2 text-sm rounded-lg border ${
                          timeStr === t
                            ? "border-[#D6C6AA] bg-gray-800"
                            : "border-gray-700 hover:bg-gray-800"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div className="bg-gray-900 rounded-xl p-5 relative">
              <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
                <span>Nome do Cliente</span>
                {searching && <Loader2 className="w-4 h-4 text-[#D6C6AA] animate-spin" />}
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => handleClientNameChange(e.target.value)}
                placeholder="Digite o nome completo"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D6C6AA]"
              />

              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => {
                        setClientName(c.full_name);
                        setClientPhone(c.phone || "");
                        setClientEmail(c.email || "");
                        setSuggestions([]);
                      }}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-700 text-gray-200"
                    >
                      <div className="font-medium">{c.full_name}</div>
                      {c.phone && <div className="text-sm text-gray-400">{c.phone}</div>}
                      {c.email && <div className="text-sm text-gray-400">{c.email}</div>}
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <input
                  type="text"
                  placeholder="Telefone (WhatsApp)"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D6C6AA]"
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D6C6AA]"
                />
              </div>
            </div>
          </section>

          {/* Pagamento */}
          <aside className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                <CreditCard className="w-4 h-4" /> Pagamento
              </div>
              <div className="space-y-3">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full bg-gray-800 rounded-lg p-3"
                >
                  <option value="">Método</option>
                  <option>Pix</option>
                  <option>Cartão</option>
                  <option>Dinheiro</option>
                  <option>Outro</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                  />
                  Marcar como <b>pago</b>
                </label>
                <textarea
                  className="w-full bg-gray-800 rounded-lg p-3 min-h-[80px]"
                  placeholder="Observações (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => router.back()}
                className="flex-1 bg-gray-800 hover:bg-gray-700 transition rounded-lg p-3"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#D6C6AA] text-black font-semibold rounded-lg p-3 hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar agendamento"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
