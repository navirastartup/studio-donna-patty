"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BG =
  "https://images.unsplash.com/photo-1673945049132-17ff2d9f60c8?q=80&w=900&auto=format&fit=crop";

interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  image_url?: string | null;
  duration_minutes?: number | null;
}
interface Professional {
  id: string;
  name: string;
  specialty?: string | null;
  image_url?: string | null;
  bio?: string | null;
}
interface Schedule {
  id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  break_start_time?: string | null;
  break_end_time?: string | null;
  professional_id?: string | null;
}

type PaymentPolicy = "none" | "deposit" | "full";
type PaymentMode = "percent" | "fixed";

export default function AgendamentoPage() {
  const router = useRouter();

  // DADOS
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<Schedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // SELEÇÕES
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // TELEFONE
  function normalizePhone(raw: string): string {
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits[2] === "9") digits = digits.slice(0, 2) + digits.slice(3);
    return digits;
  }

  const [formData, setFormData] = useState({ nome: "", telefone: "", email: "" });

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  function isValidBrazilianPhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 10) return false;
    const ddd = Number(digits.slice(0, 2));
    return ddd >= 10 && ddd <= 99;
  }

  // UI
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  // PAGAMENTO
  const [paymentPolicy, setPaymentPolicy] = useState<PaymentPolicy>("full");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("percent");
  const [paymentValue, setPaymentValue] = useState<number>(30);

  const totalSteps = 5;
  const [step, setStep] = useState<number>(1);

  const handleInputChange = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // BUSCA INICIAL
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, description, price, image_url, duration_minutes");
      setServices((servicesData as Service[]) || []);

      const { data: profData } = await supabase
        .from("professionals")
        .select("id, name, specialty, image_url, bio");
      setProfessionals((profData as Professional[]) || []);

      const { data: schedulesData } = await supabase.from("schedules").select("*");
      setAvailableSchedules((schedulesData as Schedule[]) || []);

      const { data: settingsData } = await supabase.from("settings").select("key, value");
      if (settingsData) {
        const getVal = (k: string, def?: any) =>
          settingsData.find((s: any) => s.key === k)?.value ?? def;
        setPaymentPolicy(getVal("payment_policy", "full"));
        setPaymentMode(getVal("payment_mode", "percent"));
        setPaymentValue(Number(getVal("payment_value", 30)));
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // CALCULO VALOR
  const amountDue = useMemo(() => {
    if (!selectedService) return 0;
    const base = parseFloat(selectedService.price);
    if (paymentPolicy === "none") return 0;
    if (paymentPolicy === "full") return base;
    return paymentMode === "percent"
      ? (base * paymentValue) / 100
      : paymentValue;
  }, [selectedService, paymentPolicy, paymentMode, paymentValue]);

  // BUSCA HORÁRIOS LIVRES (SEU CÓDIGO ORIGINAL)
  useEffect(() => {
    async function fetchAvailableSlots() {
      if (!selectedDate || !selectedProfessional) return setTimeSlots([]);
      try {
        const fullDate = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          selectedDate
        );
        const dayOfWeek = fullDate
          .toLocaleDateString("en-US", { weekday: "long" })
          .toLowerCase();

        const schedule = availableSchedules.find(
          (s) =>
            s.day_of_week.toLowerCase() === dayOfWeek &&
            (!s.professional_id || s.professional_id === selectedProfessional.id)
        );
        if (!schedule) return setTimeSlots([]);

        const startHour = parseInt(schedule.start_time.slice(0, 2), 10);
        const endHour = parseInt(schedule.end_time.slice(0, 2), 10);
        const breakStartHour = schedule.break_start_time
          ? parseInt(schedule.break_start_time.slice(0, 2), 10)
          : -1;
        const breakEndHour = schedule.break_end_time
          ? parseInt(schedule.break_end_time.slice(0, 2), 10)
          : -1;

        const startOfDay = new Date(fullDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(fullDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: existingAppointments } = await supabase
          .from("appointments")
          .select("start_time, end_time")
          .eq("professional_id", selectedProfessional.id)
          .gte("start_time", startOfDay.toISOString())
          .lte("end_time", endOfDay.toISOString());

        const toLocal = (d: string) =>
          new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(11, 16);

        const occupied = (existingAppointments ?? []).map((a) => ({
          start: toLocal(a.start_time),
          end: toLocal(a.end_time),
        }));

        const duration = Number(selectedService?.duration_minutes ?? 60);
        const step = duration >= 60 ? 60 : 30;

        const isOccupied = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          const slotStart = h * 60 + m;
          const slotEnd = slotStart + duration;

          return occupied.some((b) => {
            const [bh, bm] = b.start.split(":").map(Number);
            const [eh, em] = b.end.split(":").map(Number);
            const busyStart = bh * 60 + bm;
            const busyEnd = eh * 60 + em;
            return !(slotEnd <= busyStart || slotStart >= busyEnd);
          });
        };

        const slots: string[] = [];
        for (let h = startHour; h < endHour; h++) {
          for (let m = 0; m < 60; m += step) {
            if (h >= breakStartHour && h < breakEndHour) continue;
            const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            if (!isOccupied(t)) slots.push(t);
          }
        }

        setTimeSlots(slots);
      } catch {
        setTimeSlots([]);
      }
    }

    fetchAvailableSlots();
  }, [selectedDate, selectedProfessional, availableSchedules, currentMonth, selectedService]);

// CRIAR CLIENTE SE NÃO EXISTE
async function ensureClient(name: string, email: string, phone: string): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Erro ao buscar cliente:", existingError);
    throw new Error("Erro ao buscar cliente existente.");
  }

  // Já existe → retorna o ID
  if (existing?.id) return existing.id;

  // Criar novo cliente
  const { data: created, error: createError } = await supabase
    .from("clients")
    .insert({ full_name: name, email, phone })
    .select("id")
    .single();

  if (createError) {
    console.error("Erro ao criar cliente:", createError);
    throw new Error("Erro ao criar cliente.");
  }

  if (!created) {
    throw new Error("Falha ao criar cliente — retorno vazio.");
  }

  return created.id;
}

  // CONFIRMAR AGENDAMENTO
  async function handleSubmitBooking() {
    setError(null);
    setLoading(true);
    if (
      !selectedService ||
      !selectedProfessional ||
      !selectedDate ||
      !selectedTime ||
      !formData.nome ||
      !isValidBrazilianPhone(formData.telefone) ||
      !formData.email
    ) {
      setError("Preencha todos os campos corretamente.");
      setLoading(false);
      return;
    }

    const clientId = await ensureClient(formData.nome, formData.email, normalizePhone(formData.telefone));

    const [hh, mm] = selectedTime.split(":");
    const startDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      selectedDate,
      Number(hh),
      Number(mm)
    );
    const duration = Number(selectedService?.duration_minutes ?? 60);
    const endDate = new Date(startDate.getTime() + duration * 60000);

// SEM PAGAMENTO
if (paymentPolicy === "none") {
  const yyyy = currentMonth.getFullYear();
  const mm2 = String(currentMonth.getMonth() + 1).padStart(2, "0");
  const dd2 = String(selectedDate).padStart(2, "0");

  // formato que você já usava: dd/mm/yyyy
  const dateStr = `${dd2}/${mm2}/${yyyy}`;

  const res = await fetch("/api/agendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.nome,
      email: formData.email,
      phone: normalizePhone(formData.telefone),

      date: dateStr,                 // ✅ agora bate com o route.ts
      time: selectedTime,            // ✅ idem
      service: selectedService.name,
      service_id: selectedService.id,
      professional_id: selectedProfessional.id,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Erro ao agendar:", data.error);
    setError(data.error || "Erro ao criar agendamento.");
    setLoading(false);
    return;
  }

  setBookingSuccess(true);
  setTimeout(() => router.push("/success"), 2000);
  setLoading(false);
  return;
}

   // COM PAGAMENTO

const yyyy = currentMonth.getFullYear();
const mm2 = String(currentMonth.getMonth() + 1).padStart(2, "0");
const dd2 = String(selectedDate).padStart(2, "0");

const [hh2, min2] = selectedTime.split(":");

// calcular horário final SEM usar Date()
let endH = Number(hh2);
let endM = Number(min2) + duration;

while (endM >= 60) {
  endM -= 60;
  endH += 1;
}

const endHStr = String(endH).padStart(2, "0");
const endMStr = String(endM).padStart(2, "0");

const payload = {
  serviceId: selectedService.id,
  professionalId: selectedProfessional.id,
  client: {
    id: clientId,
    name: formData.nome,
    email: formData.email,
    phone: normalizePhone(formData.telefone),
  },
  startTime: `${yyyy}-${mm2}-${dd2}T${hh2}:${min2}:00`,
  endTime: `${yyyy}-${mm2}-${dd2}T${endHStr}:${endMStr}:00`,
  price: amountDue,
  policy: paymentPolicy,
};

const res = await fetch("/api/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const result = await res.json();

if (result.init_point) window.location.href = result.init_point;
else router.push("/success");

setLoading(false);
  }

  const firstDayIndex = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  if (loading && !bookingSuccess)
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-[#D6C6AA] text-xl">
        Carregando dados...
      </main>
    );

  return (
<main
  className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-[#0D0D0D]"
  style={{
    backgroundImage: `radial-gradient(circle at 0% 0%, rgba(232,220,195,0.12), transparent 40%),
                      radial-gradient(circle at 100% 100%, rgba(232,220,195,0.07), transparent 40%)`,
  }}
>
  <div className="w-full max-w-5xl bg-[#111111]/60 backdrop-blur-xl border border-[#ffffff15] rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.45)] p-10">
  <h1 className="text-center text-[3rem] font-serif tracking-tight text-[#E8DCC3] mb-12">
  Agendamento
</h1>


        {/* PASSOS */}
        <div className="flex justify-center items-center gap-3 mb-14">
  {[1,2,3,4,5].map((s) => (
    <div
      key={s}
      className={`
        w-10 h-10 flex items-center justify-center rounded-full border transition-all
        ${step === s
          ? "border-[#E8DCC3] text-[#E8DCC3] bg-transparent"
          : "border-[#ffffff20] text-[#ffffff40]"
        }
      `}
    >
      {s}
    </div>
  ))}
        </div>

        {/* ===== STEP 1 ===== */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-8 text-center">
              Selecione o Serviço
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <button
  key={service.id}
  onClick={() => { setSelectedService(service); setStep(2); }}
  className={`
    group relative p-5 rounded-xl border backdrop-blur
    transition-all duration-300 overflow-hidden
    ${selectedService?.id === service.id
      ? "border-[#E8DCC3]/60 bg-[#E8DCC3]/5 shadow-[0_0_30px_rgba(232,220,195,0.15)]"
      : "border-[#ffffff10] hover:border-[#E8DCC3]/40 bg-[#ffffff05]"
    }
  `}
>
  <img
    src={service.image_url || "https://via.placeholder.com/600x400/111/aaa?text=Serviço"}
    className="w-full h-40 object-cover rounded-lg opacity-90 group-hover:opacity-100 transition"
  />
  <div className="mt-4 text-lg text-[#E8DCC3] font-serif">{service.name}</div>
  <div className="text-[#ffffffcc] font-medium mt-1">
    R$ {Number(service.price).toFixed(2).replace(".", ",")}
  </div>
</button>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 2 ===== */}
        {step === 2 && (
  <div>
    <h2 className="text-2xl font-semibold text-[#E8DCC3] mb-8 text-center">
      Escolha o Profissional
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {professionals.map((prof) => (
        <button
          key={prof.id}
          onClick={() => {
            setSelectedProfessional(prof);
            setStep(3);
          }}
          className={`p-6 rounded-2xl bg-[#111111] border border-[#2a2a2a] transition-all duration-200 hover:scale-[1.03] hover:border-[#E8DCC3]/60 shadow-lg
          ${selectedProfessional?.id === prof.id && "border-[#E8DCC3] shadow-[0_0_20px_rgba(232,220,195,0.25)]"}`}
        >
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 border border-[#3d3d3d]">
            <img
              src={prof.image_url ?? "https://via.placeholder.com/300"}
              className="object-cover w-full h-full"
            />
          </div>
          <h3 className="text-white text-lg font-medium text-center">{prof.name}</h3>
          <p className="text-[#E8DCC3]/70 text-sm text-center">{prof.specialty}</p>
        </button>
      ))}
    </div>

    <button
      onClick={() => setStep(1)}
      className="mt-10 text-gray-400 hover:text-[#E8DCC3] transition flex items-center gap-2"
    >
      <ChevronLeft className="w-5 h-5" /> Voltar
    </button>
  </div>
)}


        {/* ===== STEP 3 ===== */}
        {step === 3 && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

  {/* CALENDÁRIO */}
  <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-lg">

    <h2 className="text-xl font-semibold text-[#E8DCC3] mb-6">
      Selecione a Data
    </h2>

    <div className="flex items-center justify-between text-[#E8DCC3] mb-4">
      <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
        <ChevronLeft />
      </button>

      <span className="font-medium tracking-wide">
        {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </span>

      <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
        <ChevronRight />
      </button>
    </div>

    <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
      {["dom", "seg", "ter", "qua", "qui", "sex", "sab"].map((d) => (<span key={d}>{d}</span>))}
    </div>

    <div className="grid grid-cols-7 gap-2 text-center">
      {Array.from({ length: firstDayIndex }).map((_, i) => (
        <span key={i} />
      ))}

      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
        const selected = selectedDate === day;
        return (
          <button
            key={day}
            onClick={() => setSelectedDate(day)}
            className={`p-2 rounded-lg text-sm transition ${
              selected
                ? "bg-[#E8DCC3] text-black shadow-md"
                : "text-gray-300 hover:bg-[#272727]"
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>

    <h3 className="mt-6 text-[#E8DCC3] font-medium text-sm">Horário</h3>

<div className="flex flex-wrap gap-2 mt-3">
  {timeSlots.length > 0 ? (
    timeSlots.map((t) => (
      <button
        key={t}
        onClick={() => setSelectedTime(t)}
        className={`px-4 py-2 rounded-full text-sm transition ${
          selectedTime === t
            ? "bg-[#E8DCC3] text-black shadow-lg"
            : "bg-[#1d1d1d] text-gray-300 hover:bg-[#2a2a2a]"
        }`}
      >
        {t}
      </button>
    ))
  ) : (
    <p className="text-gray-500 text-sm mt-2">Nenhum horário disponível para esta data.</p>
  )}
</div>
          </div>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-lg">
            <h4 className="text-xl font-semibold text-[#E8DCC3] mb-4">
            Detalhes do Agendamento
            </h4>
            <div className="space-y-2 text-sm text-gray-300">
                {selectedService && (
                  <p>
                    <span className="text-gray-400">Serviço:</span>{" "}
                    <span className="text-white">{selectedService.name}</span>
                  </p>
                )}
                {selectedProfessional && (
                  <p>
                    <span className="text-gray-400">Profissional:</span>{" "}
                    <span className="text-white">{selectedProfessional.name}</span>
                  </p>
                )}
                {selectedDate && selectedTime ? (
                  <p>
                    <span className="text-gray-400">Data e Hora:</span>{" "}
                    <span className="text-white">
                      {selectedDate} de{" "}
                      {currentMonth.toLocaleDateString("pt-BR", {
                        month: "long",
                      })}{" "}
                      às {selectedTime}
                    </span>
                  </p>
                ) : (
                  <p className="text-gray-500">Selecione data e horário</p>
                )}

                {selectedService && paymentPolicy !== "none" && (
                  <p className="text-lg">
                    <span className="text-gray-400">A pagar agora:</span>{" "}
                    <span className="text-[#D6C6AA] font-semibold">
                      R$ {amountDue.toFixed(2).replace(".", ",")}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setStep(2)}
                  className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Voltar
                </button>
                <button
  onClick={() => setStep(4)}
  disabled={!selectedDate || !selectedTime}
  className="bg-[#E8DCC3] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#f3ead6] transition disabled:opacity-40"
>
  Continuar <ChevronRight className="w-5 h-5 inline-block ml-2" />
</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 4 ===== */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-6 text-center">
              Seus Dados
            </h2>
            <div className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  placeholder="Digite seu nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Telefone (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange("telefone", formatPhone(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  placeholder="(73) 9840-1234"
                />
                {formData.telefone && !isValidBrazilianPhone(formData.telefone) && (
                  <p className="text-red-400 text-sm mt-1">
                    Digite DD + número sem o 9 extra. Ex: (73) 9840-1234
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(3)}
                className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Voltar
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={
                  !formData.nome || !formData.email || !isValidBrazilianPhone(formData.telefone)
                }
                className="bg-[#D6C6AA] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50"
              >
                Revisar <ChevronRight className="w-5 h-5 inline-block ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 5 ===== */}
        {step === 5 && (
          <div>
<h2 className="text-center text-[1.75rem] font-semibold text-[#E8DCC3] mb-10">
  Confirme seu Agendamento
</h2>

<div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-8 shadow-xl max-w-xl w-full mx-auto text-gray-300 space-y-3">

  <h3 className="text-[#E8DCC3] text-xl font-medium mb-4">Detalhes:</h3>

  <p><span className="text-[#E8DCC3]/80">Serviço:</span> {selectedService?.name}</p>
  <p><span className="text-[#E8DCC3]/80">Profissional:</span> {selectedProfessional?.name}</p>
  <p><span className="text-[#E8DCC3]/80">Data:</span> {selectedDate} de {currentMonth.toLocaleDateString("pt-BR", {month:"long"})}</p>
  <p><span className="text-[#E8DCC3]/80">Horário:</span> {selectedTime}</p>
  <p><span className="text-[#E8DCC3]/80">Nome:</span> {formData.nome}</p>
  <p><span className="text-[#E8DCC3]/80">Telefone:</span> {formData.telefone}</p>
  <p><span className="text-[#E8DCC3]/80">E-mail:</span> {formData.email}</p>

  {selectedService?.duration_minutes && (
    <p><span className="text-[#E8DCC3]/80">Duração:</span> {selectedService.duration_minutes} min</p>
  )}

  {paymentPolicy === "none" ? (
    <p className="text-[#E8DCC3] text-lg font-semibold mt-4">
      Sem pagamento antecipado
    </p>
  ) : (
    <p className="text-[#E8DCC3] text-lg font-semibold mt-4">
      A pagar agora: R$ {amountDue.toFixed(2).replace(".", ",")}
    </p>
  )}
</div>

<div className="max-w-xl w-full mx-auto flex justify-between mt-10">
  <button
    onClick={() => setStep(4)}
    className="text-gray-400 hover:text-[#E8DCC3] transition flex items-center gap-2"
  >
    <ChevronLeft className="w-5 h-5" /> Voltar
  </button>

  <button
    onClick={handleSubmitBooking}
    disabled={loading}
    className="bg-[#E8DCC3] text-black font-semibold px-8 py-3 rounded-xl hover:bg-[#f3ead6] transition disabled:opacity-40"
  >
    {loading ? "Processando..." : "Confirmar Agendamento"}
  </button>
</div>

            {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
            {bookingSuccess && (
              <p className="text-green-500 mt-4 text-center">
                Agendamento criado com sucesso!
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
