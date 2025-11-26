"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, CreditCard, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PremiumCalendar from "@/components/PremiumCalendar";


type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes?: number | null;
  image_url?: string | null;
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

  const [payMethod, setPayMethod] =
    useState<"Pix" | "Cartão" | "Dinheiro" | "Outro" | "">("");
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

  // dropdown premium de serviço
  const [serviceOpen, setServiceOpen] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || null,
    [services, serviceId]
  );

  // carregar dados base
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: s1 }, { data: s2 }, { data: s3 }] = await Promise.all([
          supabase
            .from("services")
            .select("id, name, price, duration_minutes, image_url")
            .order("name"),
          supabase
            .from("professionals")
            .select("id, name, specialty, image_url")
            .order("name"),
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
  if (!dateStr || !professionalId || !serviceId) return [];

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

  const srv = services.find((s) => s.id === serviceId);
  const duration = srv?.duration_minutes || 60;

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const start = toMinutes(sc.start_time);
  const end = toMinutes(sc.end_time);

  const breakStart = sc.break_start_time ? toMinutes(sc.break_start_time) : null;
  const breakEnd = sc.break_end_time ? toMinutes(sc.break_end_time) : null;

  const arr: string[] = [];

  // GERAR HORÁRIOS DE 1 EM 1 HORA (SEM MEIA HORA)
// GERAR HORÁRIOS DE 1 EM 1 HORA
for (let t = start; t <= end; t += 60) {
  const slotStart = t;
  const slotEnd = t + duration;

  // pausa
  if (breakStart !== null && breakEnd !== null) {
    if (slotStart >= breakStart && slotStart < breakEnd) continue;
  }

  // PERMITIR AGENDAR 18:00 MESMO SE O SERVIÇO TERMINAR DEPOIS DO EXPEDIENTE
  if (slotStart > end) continue;

  const hh = String(Math.floor(t / 60)).padStart(2, "0");
  const mm = "00";
  const slot = `${hh}:${mm}`;

  // checar conflito
  const conflict = bookedTimes.some((b) => {
    const bStart = toMinutes(b.start);
    const bEnd = toMinutes(b.end);

    return (
      (slotStart >= bStart && slotStart < bEnd) ||
      (slotEnd > bStart && slotEnd <= bEnd)
    );
  });

  if (!conflict) arr.push(slot);
}

  // ADICIONAR **13:30** QUANDO A VOLTA DO INTERVALO FOR 13:30
  if (breakEnd === 13 * 60 + 30) {
    const slotStart = 13 * 60 + 30;
    const slotEnd = slotStart + duration;

    if (slotEnd <= end) {
      const hh = "13";
      const mm = "30";
      const slot = `${hh}:${mm}`;

      const conflict = bookedTimes.some((b) => {
        const bStart = toMinutes(b.start);
        const bEnd = toMinutes(b.end);
        return (
          (slotStart >= bStart && slotStart < bEnd) ||
          (slotEnd > bStart && slotEnd <= bEnd)
        );
      });

      if (!conflict) arr.push(slot);
    }
  }

  // ORDENAR OS HORÁRIOS EM ORDEM CRESCENTE
  arr.sort((a, b) => toMinutes(a) - toMinutes(b));

  return arr;
}, [dateStr, professionalId, serviceId, schedules, bookedTimes, services]);


  // 🔍 Busca com debounce + ícone de carregamento
const handleClientNameChange = (value: string) => {
  setClientName(value);

  // Se apagou tudo → esconde tudo imediatamente
  if (value.trim().length === 0) {
    setSuggestions([]);
    setSearching(false);
    if (debounceTimer) clearTimeout(debounceTimer);
    return;
  }

  // Cancela debounce anterior
  if (debounceTimer) clearTimeout(debounceTimer);

  setSearching(true);

  const timer = setTimeout(async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, phone, email")
      .ilike("full_name", `%${value}%`)
      .limit(8);

    setSearching(false);
    if (!error) setSuggestions(data || []);
  }, 200); // resposta mais rápida

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
      const start_time = `${dateStr}T${hh}:${mm}:00`;

      const startDateLocal = new Date(`${dateStr}T${hh}:${mm}:00`);
      startDateLocal.setMinutes(startDateLocal.getMinutes() + duration);

      const endH = String(startDateLocal.getHours()).padStart(2, "0");
      const endM = String(startDateLocal.getMinutes()).padStart(2, "0");
      const end_time = `${dateStr}T${endH}:${endM}:00`;

      const amount = srv?.price ?? 0;

      const res = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment: {
            service_id: serviceId,
            professional_id: professionalId,
            client_id: clientId,
            client_email: clientEmail,

            date: dateStr,
            time: timeStr,

            start_time,
            end_time,

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
    <main className="p-6 bg-black/20 backdrop-blur-xl min-h-screen border border-[#D6C6AA]/5 rounded-3xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D6C6AA]/10 border border-[#D6C6AA]/30">
          <CalendarDays className="w-5 h-5 text-[#D6C6AA]" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#D6C6AA] tracking-tight">
            Agendamento Manual
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Crie um agendamento direto pelo painel!
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[#D6C6AA]">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
          {/* Coluna principal */}
          <section className="space-y-6">
            {/* Bloco serviço + profissional */}
            <div className="bg-gradient-to-br from-gray-900/90 to-black/90 rounded-2xl border border-[#D6C6AA]/15 shadow-[0_18px_45px_rgba(0,0,0,0.7)] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase text-gray-500 tracking-[0.18em] mb-1">
                    Configuração do Atendimento
                  </p>
                  <h2 className="text-lg font-medium text-[#D6C6AA]">
                    Serviço & Profissional
                  </h2>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Serviço - dropdown premium */}
                <div className="relative">
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-[0.12em]">
                    Serviço
                  </label>

                  <button
                    type="button"
                    onClick={() => setServiceOpen((v) => !v)}
                    className="w-full bg-gray-900/80 border border-[#D6C6AA]/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:border-[#D6C6AA]/60 transition focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-800 border border-gray-700/80">
                        {selectedService?.image_url ? (
                          <Image
                            src={selectedService.image_url}
                            alt={selectedService.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                            Serviço
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-white font-medium">
                          {selectedService ? selectedService.name : "Selecione o serviço"}
                        </p>
                        {selectedService && (
                          <p className="text-xs text-gray-400">
                            R$ {selectedService.price.toFixed(2).replace(".", ",")}{" "}
                            {selectedService.duration_minutes
                              ? `• ${selectedService.duration_minutes} min`
                              : null}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#D6C6AA] transition-transform ${
                        serviceOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {serviceOpen && (
                    <div className="absolute z-30 mt-2 w-full bg-gray-950/95 border border-[#D6C6AA]/25 rounded-xl shadow-2xl max-h-72 overflow-auto backdrop-blur-md">
                      {services.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setServiceId(s.id);
                            setServiceOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-900/80 transition ${
                            serviceId === s.id ? "bg-gray-900/70" : ""
                          }`}
                        >
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-800 border border-gray-700/80 flex-shrink-0">
                            {s.image_url ? (
                              <Image
                                src={s.image_url}
                                alt={s.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                                Serviço
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-100 font-medium">
                              {s.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              R$ {s.price.toFixed(2).replace(".", ",")}{" "}
                              {s.duration_minutes ? `• ${s.duration_minutes} min` : ""}
                            </span>
                          </div>
                        </button>
                      ))}

                      {services.length === 0 && (
                        <div className="px-4 py-3 text-xs text-gray-500">
                          Nenhum serviço cadastrado.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Profissional */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-[0.12em]">
                    Profissional
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {professionals.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProfessionalId(p.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                          professionalId === p.id
                            ? "border-[#D6C6AA] bg-[#D6C6AA]/5 shadow-[0_0_22px_rgba(214,198,170,0.18)]"
                            : "border-gray-700/80 bg-gray-900/60 hover:border-[#D6C6AA]/40 hover:bg-gray-900"
                        }`}
                      >
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-800">
                          {p.image_url ? (
                            <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                              Profissional
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.specialty || "—"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Data e horário */}
            <div className="bg-gray-950/80 rounded-2xl border border-[#D6C6AA]/15 p-5 md:p-6">
              <p className="text-[11px] uppercase text-gray-500 tracking-[0.18em] mb-1">
                Agenda
              </p>
              <h2 className="text-lg font-medium text-[#D6C6AA] mb-5">
                Data & Horário do Atendimento
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-[0.12em]">
                    Data
                  </label>
<PremiumCalendar
  value={dateStr}
  onChange={(v) => {
    setDateStr(v);
    setTimeStr("");
  }}
/>

                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-400 mb-2 flex items-center gap-2 uppercase tracking-[0.12em]">
                    <Clock className="w-4 h-4" /> Horário
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {timeSlots.length === 0 && (
                      <span className="text-gray-500 text-sm">
                        Selecione serviço, profissional e data para ver os horários.
                      </span>
                    )}
                    {timeSlots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTimeStr(t)}
                        className={`px-3 py-2 text-xs rounded-full border transition ${
                          timeStr === t
                            ? "border-[#D6C6AA] bg-[#D6C6AA]/10 text-[#D6C6AA]"
                            : "border-gray-700/80 bg-gray-900/60 text-gray-200 hover:border-[#D6C6AA]/40"
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
            <div className="bg-gray-950/80 rounded-2xl border border-[#D6C6AA]/15 p-5 md:p-6 relative">
              <p className="text-[11px] uppercase text-gray-500 tracking-[0.18em] mb-1">
                Cliente
              </p>
              <h2 className="text-lg font-medium text-[#D6C6AA] mb-4">
                Dados do Cliente
              </h2>

              <label className="block text-xs text-gray-400 mb-2 flex items-center justify-between uppercase tracking-[0.12em]">
                <span>Nome completo</span>
                {searching && <Loader2 className="w-4 h-4 text-[#D6C6AA] animate-spin" />}
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => handleClientNameChange(e.target.value)}
                placeholder="Digite o nome completo"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]/70"
              />

              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl shadow-2xl max-h-60 overflow-auto">
                  {suggestions.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => {
                        setClientName(c.full_name);
                        setClientPhone(c.phone || "");
                        setClientEmail(c.email || "");
                        setSuggestions([]);
                      }}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-900 text-gray-200"
                    >
                      <div className="font-medium text-sm">{c.full_name}</div>
                      {c.phone && (
                        <div className="text-xs text-gray-400">{c.phone}</div>
                      )}
                      {c.email && (
                        <div className="text-xs text-gray-400">{c.email}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-[0.12em]">
                    Telefone (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="Telefone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]/70"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-[0.12em]">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="E-mail"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]/70"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Coluna lateral (resumo + pagamento) */}
          <aside className="space-y-6">
            {/* Resumo do agendamento */}
            <div className="bg-gray-950/80 rounded-2xl border border-[#D6C6AA]/20 p-5 md:p-6">
              <p className="text-[11px] uppercase text-gray-500 tracking-[0.18em] mb-1">
                Resumo
              </p>
              <h2 className="text-lg font-medium text-[#D6C6AA] mb-4">
                Detalhes do agendamento
              </h2>

              <div className="space-y-3 text-sm text-gray-200">
                <div className="flex gap-3 items-center">
                  <span className="text-xs text-gray-400 w-20">Serviço</span>
                  <div className="flex-1">
                    <p className="font-medium">
                      {selectedService ? selectedService.name : "—"}
                    </p>
                    {selectedService && (
                      <p className="text-xs text-gray-400">
                        R$ {selectedService.price.toFixed(2).replace(".", ",")}{" "}
                        {selectedService.duration_minutes
                          ? `• ${selectedService.duration_minutes} min`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 items-center">
                  <span className="text-xs text-gray-400 w-20">Profissional</span>
                  <p className="flex-1 font-medium">
                    {professionalId
                      ? professionals.find((p) => p.id === professionalId)?.name || "—"
                      : "—"}
                  </p>
                </div>

                <div className="flex gap-3 items-center">
                  <span className="text-xs text-gray-400 w-20">Data</span>
                  <p className="flex-1">
                    {dateStr ? new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>

                <div className="flex gap-3 items-center">
                  <span className="text-xs text-gray-400 w-20">Horário</span>
                  <p className="flex-1">{timeStr || "—"}</p>
                </div>

                <div className="h-px bg-gray-800 my-2" />

                <div className="flex gap-3 items-start">
                  <span className="text-xs text-gray-400 w-20">Cliente</span>
                  <div className="flex-1">
                    <p className="font-medium">{clientName || "—"}</p>
                    {clientEmail && (
                      <p className="text-xs text-gray-400">{clientEmail}</p>
                    )}
                    {clientPhone && (
                      <p className="text-xs text-gray-500">{clientPhone}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div className="bg-gradient-to-br from-gray-950 to-black rounded-2xl border border-[#D6C6AA]/25 p-5 md:p-6">
              <div className="flex items-center gap-2 text-gray-300 text-sm mb-4">
                <div className="h-8 w-8 rounded-xl bg-[#D6C6AA]/10 flex items-center justify-center border border-[#D6C6AA]/40">
                  <CreditCard className="w-4 h-4 text-[#D6C6AA]" />
                </div>
                <div>
                  <p className="text-[11px] uppercase text-gray-500 tracking-[0.18em]">
                    Pagamento
                  </p>
                  <p className="text-sm font-medium text-[#D6C6AA]">
                    Registrar agora pelo painel
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full bg-gray-900 border border-gray-700/80 rounded-xl px-3 py-3 text-sm text-gray-100 focus:outline-none focus:border-[#D6C6AA]/80"
                >
                  <option value="">Método de pagamento</option>
                  <option>Pix</option>
                  <option>Cartão</option>
                  <option>Dinheiro</option>
                  <option>Outro</option>
                </select>

                <label className="flex items-center gap-2 text-sm text-gray-200 mt-1">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="accent-[#D6C6AA]"
                  />
                  Marcar como <span className="font-semibold ml-1">pago</span>
                </label>

                <textarea
                  className="w-full bg-gray-900 border border-gray-700/80 rounded-xl px-3 py-3 text-sm text-gray-100 placeholder-gray-500 min-h-[90px] focus:outline-none focus:border-[#D6C6AA]/80"
                  placeholder="Observações internas (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* Ações */}
            <div className="flex gap-3">
              <button
                onClick={() => router.back()}
                className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700/80 text-gray-200 rounded-xl py-3 text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#D6C6AA] text-black font-semibold rounded-xl py-3 text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_12px_30px_rgba(214,198,170,0.40)]"
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
