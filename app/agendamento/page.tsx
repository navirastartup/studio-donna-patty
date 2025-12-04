"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Sparkles,
  Timer,
  CreditCard,
  User2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import toast from "react-hot-toast"; // <-- IMPORT OK
import LoadingScreen from "@/components/LoadingScreen";
import { Suspense } from "react";

const BG =
  "https://images.unsplash.com/photo-1673945049132-17ff2d9f60c8?q=80&w=900&auto=format&fit=crop";

/* ============================================================
 * Helpers de preço
 * ============================================================ */
const formatCurrency = (value: number) =>
  value.toFixed(2).replace(".", ",");

const applyDiscount = (price: number, discount?: number | null) => {
  if (!discount || discount <= 0) return price;
  const final = price * (1 - discount / 100);
  return Math.round(final * 100) / 100;
};

const CLIENT_DATA_KEY = "studio-donna-patty-client";

/* ============================================================
 * Tipos
 * ============================================================ */
interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  duration_minutes?: number | null;
  discount_percent?: number | null;
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



function AgendamentoPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AgendamentoPage />
    </Suspense>
  );
}

export default AgendamentoPageWrapper;

/* ============================================================
 * Página
 * ============================================================ */
function AgendamentoPage() {

  const router = useRouter();
  const { addService } = useCart(); 

  const searchParams = useSearchParams();

// Muda o nome aqui pro que você realmente usa na URL:
// ?serviceIndex=0  ou  ?item=abc  etc.
const serviceKey =
  searchParams.get("serviceIndex") ??
  searchParams.get("item") ??
  searchParams.get("serviceId") ??
  ""; // fallback

// função pra limpar seleção do agendamento
function resetSelection() {
  setSelectedProfessional(null);
  setSelectedDate(null);
  setSelectedTime(null);
  setTimeSlots([]);
  setClosed(false);
  setStep(1); // volta pro início do fluxo (se quiser pode ser 2)
}


  // Dados
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<Schedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // Seleções
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // Inputs cliente
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
  });

  const [closed, setClosed] = useState(false);

  const handleInputChange = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  function normalizePhone(raw: string): string {
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits[2] === "9")
      digits = digits.slice(0, 2) + digits.slice(3);
    return digits;
  }

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

  // Pagamento
  const [paymentPolicy, setPaymentPolicy] = useState<PaymentPolicy>("full");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("percent");
  const [paymentValue, setPaymentValue] = useState<number>(30);

  const [step, setStep] = useState<number>(1);

  /* ============================================================
   * Carregar dados do cliente do navegador
   * ============================================================ */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(CLIENT_DATA_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Erro ao carregar dados do cliente:", e);
    }
  }, []);

  // Sempre que digitar, salva
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CLIENT_DATA_KEY, JSON.stringify(formData));
    } catch (e) {
      console.error("Erro ao salvar dados do cliente:", e);
    }
  }, [formData]);

  /* ============================================================
   * Buscar dados iniciais
   * ============================================================ */
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, description, price, image_url, duration_minutes, discount_percent");
      setServices((servicesData as Service[]) || []);

      const { data: profData } = await supabase
        .from("professionals")
        .select("id, name, specialty, image_url, bio");
      setProfessionals((profData as Professional[]) || []);

      const { data: schedulesData } = await supabase.from("schedules").select("*");
      setAvailableSchedules((schedulesData as Schedule[]) || []);

      const { data: settingsData } = await supabase
        .from("settings")
        .select("key, value");

      if (settingsData) {
        const getVal = (k: string, def?: any) =>
          (settingsData as any[]).find((s) => s.key === k)?.value ?? def;

        setPaymentPolicy(getVal("payment_policy", "full"));
        setPaymentMode(getVal("payment_mode", "percent"));
        setPaymentValue(Number(getVal("payment_value", 30)));
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  // sempre que mudar o serviço que está sendo agendado, zera escolhas
useEffect(() => {
  resetSelection();
}, [serviceKey]);


  /* ============================================================
   * Calcular valor devido
   * ============================================================ */
  const amountDue = useMemo(() => {
    if (!selectedService) return 0;

    const base = Number(selectedService.price ?? 0);
    const priceWithDiscount = applyDiscount(
      base,
      selectedService.discount_percent
    );

    if (paymentPolicy === "none") return 0;
    if (paymentPolicy === "full") return priceWithDiscount;

    return paymentMode === "percent"
      ? (priceWithDiscount * paymentValue) / 100
      : paymentValue;
  }, [selectedService, paymentPolicy, paymentMode, paymentValue]);

  /* ============================================================
   * Horários disponíveis
   * ============================================================ */
  useEffect(() => {
    async function fetchAvailable() {
      if (!selectedDate || !selectedProfessional || !selectedService) {
        setTimeSlots([]);
        setClosed(false);
        return;
      }

      const yyyy = currentMonth.getFullYear();
      const mm = String(currentMonth.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate).padStart(2, "0");

      const res = await fetch("/api/appointments/available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: `${yyyy}-${mm}-${dd}`,
          professional_id: selectedProfessional.id,
          service_id: selectedService.id,
        }),
      });

      const data = await res.json();

      setClosed(Boolean(data.closed));
      setTimeSlots(data.available ?? []);
    }

    fetchAvailable();
  }, [selectedDate, selectedProfessional, selectedService, currentMonth]);

  /* ============================================================
   * Criar cliente
   * ============================================================ */
  async function ensureClient(name: string, email: string, phone: string): Promise<string> {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created } = await supabase
      .from("clients")
      .insert({ full_name: name, email, phone })
      .select("id")
      .single();

    return created?.id!;
  }

  /* ============================================================
   * Confirmar Agendamento
   * ============================================================ */
  async function handleSubmitBooking() {
    setError(null);
    setLoading(true);

    if (
      !selectedService ||
      !selectedProfessional ||
      !selectedDate ||
      !selectedTime ||
      !formData.nome ||
      !formData.email ||
      !isValidBrazilianPhone(formData.telefone)
    ) {
      setError("Preencha todos os campos corretamente.");
      setLoading(false);
      return;
    }

    const clientId = await ensureClient(
      formData.nome,
      formData.email,
      normalizePhone(formData.telefone)
    );

    const [hh, mm] = selectedTime.split(":");
    const yyyy = currentMonth.getFullYear();
    const mm2 = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dd2 = String(selectedDate).padStart(2, "0");

    const duration = Number(selectedService?.duration_minutes ?? 60);

    const startTime = `${yyyy}-${mm2}-${dd2}T${hh}:${mm}:00`;

    const endD = new Date(yyyy, currentMonth.getMonth(), selectedDate, Number(hh), Number(mm));
    endD.setMinutes(endD.getMinutes() + duration);

    const endH = String(endD.getHours()).padStart(2, "0");
    const endM = String(endD.getMinutes()).padStart(2, "0");

    const endTime = `${yyyy}-${mm2}-${dd2}T${endH}:${endM}:00`;

    // SEM PAGAMENTO
    if (paymentPolicy === "none") {
      const res = await fetch("/api/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.nome,
          email: formData.email,
          phone: normalizePhone(formData.telefone),
          start_time: startTime,
          end_time: endTime,
          service: selectedService.name,
          service_id: selectedService.id,
          professional_id: selectedProfessional.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setBookingSuccess(true);
      setTimeout(() => router.push("/success"), 1500);
      setLoading(false);
      return;
    }

    // COM PAGAMENTO
    const payload = {
      serviceId: selectedService.id,
      professionalId: selectedProfessional.id,
      client: {
        id: clientId,
        name: formData.nome,
        email: formData.email,
        phone: normalizePhone(formData.telefone),
      },
      startTime,
      endTime,
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

  /* ============================================================
   * Render
   * ============================================================ */
  const firstDayIndex = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

if (loading) return <LoadingScreen />;

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-[#0D0D0D]"
      style={{
        backgroundImage: `radial-gradient(circle at 0% 0%, rgba(232,220,195,0.12), transparent 40%),
                          radial-gradient(circle at 100% 100%, rgba(232,220,195,0.07), transparent 40%)`,
      }}
    >
      <div className="w-full max-w-5xl bg-[#111111]/60 backdrop-blur-xl border border-[#ffffff15] rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.45)] p-10">

        {/* Título */}
        <h1 className="text-center text-[3rem] font-serif tracking-tight text-[#E8DCC3] mb-12">
          Agendamento
        </h1>

        {/* Passos */}
        <div className="flex justify-center items-center gap-3 mb-14">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`
                w-10 h-10 flex items-center justify-center rounded-full border transition-all
                ${
                  step === s
                    ? "border-[#E8DCC3] text-[#E8DCC3]"
                    : "border-[#ffffff20] text-[#ffffff40]"
                }
              `}
            >
              {s}
            </div>
          ))}
        </div>

        {/* STEP 1 — Serviço */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-8 text-center">
              Selecione o Serviço
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => {
                const basePrice = Number(service.price ?? 0);
                const hasDiscount =
                  service.discount_percent != null &&
                  service.discount_percent > 0;
                const finalPrice = applyDiscount(basePrice, service.discount_percent);

                return (
<div
  key={service.id}
  onClick={() => {
    setSelectedService(service);
    setStep(2);
  }}
  className={`
    group relative p-5 rounded-xl border backdrop-blur
    transition-all duration-300 overflow-hidden w-full text-left cursor-pointer
    ${
      selectedService?.id === service.id
        ? "border-[#E8DCC3]/60 bg-[#E8DCC3]/5 shadow-[0_0_30px_rgba(232,220,195,0.15)]"
        : "border-[#ffffff10] hover:border-[#E8DCC3]/40 bg-[#ffffff05]"
    }
  `}
>
  <img
    src={
      service.image_url ||
      "https://via.placeholder.com/600x400/111/aaa?text=Serviço"
    }
    className="w-full h-40 object-cover rounded-lg opacity-90 group-hover:opacity-100 transition"
  />

  {service.description && (
    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
      {service.description}
    </p>
  )}

  <div className="mt-4 text-lg text-[#E8DCC3] font-serif">
    {service.name}
  </div>

  {!hasDiscount && (
    <div className="text-[#ffffffcc] font-medium mt-1">
      R$ {formatCurrency(basePrice)}
    </div>
  )}

  {hasDiscount && (
    <div className="mt-1 text-sm">
      <div className="text-[#E8DCC3] font-semibold">
        R$ {formatCurrency(finalPrice)}
      </div>
      <div className="text-xs text-gray-400">
        De R$ {formatCurrency(basePrice)} · {service.discount_percent}% de desconto
      </div>
    </div>
  )}

  {/* BOTÕES */}
  <div className="mt-5 flex flex-col gap-2">

    {/* Agendar Agora */}
    <div
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedService(service);
        setStep(2);
      }}
      className="w-full py-2 rounded-md bg-[#E8DCC3] text-black font-semibold hover:bg-[#f3ead6] transition text-center"
    >
      Agendar Agora
    </div>

    {/* Carrinho */}
   <button
  onClick={(e) => {
    e.stopPropagation();

addService({
  id: crypto.randomUUID(), // id único do item do carrinho
  service_id: service.id,  // id REAL do serviço
  name: service.name,
  price: service.price,
  image_url: service.image_url ?? null,
  duration_minutes: service.duration_minutes ?? null,
  date: null,
  time: null,
  professional_id: null,
  client_name: formData.nome,
  client_email: formData.email,
  client_phone: normalizePhone(formData.telefone),
});


toast.custom((t) => (
  <div
    className={`
      flex items-center gap-4
      bg-[#111111] border border-[#E8DCC3]/40 
      text-[#E8DCC3]
      px-4 py-3 rounded-xl shadow-lg
      transition-all duration-300
      ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
    `}
  >
    <span className="text-lg">🛒</span>

    <div className="flex flex-col">
      <span className="font-semibold">Serviço adicionado ao carrinho</span>
      <button
        onClick={() => {
          router.push("/carrinho");
          toast.dismiss(t.id);
        }}
        className="mt-1 text-xs underline underline-offset-4 hover:text-white"
      >
        Ver carrinho
      </button>
    </div>

    <button
      onClick={() => toast.dismiss(t.id)}
      className="ml-2 text-[#E8DCC3]/70 hover:text-[#E8DCC3]"
    >
      ✕
    </button>
  </div>
));

  }}
  className="w-full py-2 rounded-md border border-[#E8DCC3]/40 text-[#E8DCC3] hover:bg-[#E8DCC3]/10 transition"
>
  Adicionar ao Carrinho
</button>

  </div>
</div>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2 — Profissional */}
        {step === 2 && (
          <>
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
                  className={`
                    p-6 rounded-2xl bg-[#111111] border border-[#2a2a2a]
                    transition-all duration-200 hover:scale-[1.03] hover:border-[#E8DCC3]/60 shadow-lg
                    ${
                      selectedProfessional?.id === prof.id &&
                      "border-[#E8DCC3] shadow-[0_0_20px_rgba(232,220,195,0.25)]"
                    }
                  `}
                >
                  <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 border border-[#3d3d3d]">
                    <img
                      src={prof.image_url ?? "https://via.placeholder.com/300"}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <h3 className="text-white text-lg font-medium text-center">
                    {prof.name}
                  </h3>
                  <p className="text-[#E8DCC3]/70 text-sm text-center">
                    {prof.specialty}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="mt-10 text-gray-400 hover:text-[#E8DCC3] transition flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" /> Voltar
            </button>
          </>
        )}

{/* STEP 3 — Calendário + Horários */}
{step === 3 && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
    
    {/* Calendário */}
    <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-[#E8DCC3] mb-6">
        Selecione a Data
      </h2>

      {/* Navegação mês */}
      <div className="flex items-center justify-between text-[#E8DCC3] mb-4">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() - 1,
                1
              )
            )
          }
        >
          <ChevronLeft />
        </button>

        <span className="font-medium tracking-wide">
          {currentMonth.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </span>

        <button
          onClick={() =>
            setCurrentMonth(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1,
                1
              )
            )
          }
        >
          <ChevronRight />
        </button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sab"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      {/* Dias do mês */}
      <div className="grid grid-cols-7 gap-2 text-center">
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <span key={i} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const thisDay = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            day
          );

          const isPast = thisDay < today;
          const selected = selectedDate === day;

          return (
            <button
              key={day}
              disabled={isPast}
              onClick={() => !isPast && setSelectedDate(day)}
              className={`
                p-2 rounded-lg text-sm transition
                ${
                  isPast
                    ? "opacity-30 cursor-not-allowed text-gray-600"
                    : selected
                      ? "bg-[#E8DCC3] text-black shadow-md"
                      : "text-gray-300 hover:bg-[#272727]"
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 text-[#E8DCC3] font-medium text-sm">
        Horário
      </h3>

      {/* HORÁRIOS */}
      <div className="flex flex-wrap gap-2 mt-3">

        {closed ? (
          /* DIA FECHADO (somente se a API disser closed=true) */
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4f4f" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Fechado
          </div>

        ) : (
          (() => {
            const now = new Date();

            const isToday =
              selectedDate &&
              currentMonth.getFullYear() === now.getFullYear() &&
              currentMonth.getMonth() === now.getMonth() &&
              selectedDate === now.getDate();

            const validSlots = isToday
              ? timeSlots.filter((t) => {
                  const [hh, mm] = t.split(":").map(Number);
                  const slotDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    hh,
                    mm
                  );
                  return slotDate.getTime() > now.getTime();
                })
              : timeSlots;

            if (validSlots.length === 0) {
              return (
                <p className="text-gray-500 text-sm mt-2">
                  Nenhum horário disponível
                </p>
              );
            }

            return validSlots.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`
                  px-4 py-2 rounded-full text-sm transition
                  ${
                    selectedTime === t
                      ? "bg-[#E8DCC3] text-black shadow-lg"
                      : "bg-[#1d1d1d] text-gray-300 hover:bg-[#2a2a2a]"
                  }
                `}
              >
                {t}
              </button>
            ));
          })()
        )}

      </div>
    </div>

    {/* Detalhes (mantém o seu mesmo depois) */}

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
              {currentMonth.toLocaleDateString("pt-BR", { month: "long" })} às{" "}
              {selectedTime}
            </span>
          </p>
        ) : (
          <p className="text-gray-500">Selecione data e horário</p>
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
          className="
            bg-[#E8DCC3] text-black font-semibold 
            px-5 py-2 rounded-xl 
            hover:bg-[#f3ead6] transition
            disabled:opacity-40
            text-sm
            sm:text-base
          "
        >
          Continuar <ChevronRight className="w-5 h-5 inline-block ml-1" />
        </button>
      </div>
    </div>

  </div>
)}

        {/* STEP 4 — Dados Cliente */}
        {step === 4 && (
          <>

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
                  onChange={(e) =>
                    handleInputChange("telefone", formatPhone(e.target.value))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  placeholder="(73) 9840-1234"
                />
                {formData.telefone &&
                  !isValidBrazilianPhone(formData.telefone) && (
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
                  onChange={(e) =>
                    handleInputChange("email", e.target.value)
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="flex justify-between mt-8 items-center gap-3">
              <button
                onClick={() => setStep(3)}
                className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Voltar
              </button>

              <button
                onClick={() => setStep(5)}
                disabled={
                  !formData.nome ||
                  !formData.email ||
                  !isValidBrazilianPhone(formData.telefone)
                }
                className="bg-[#D6C6AA] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50"
              >
                Revisar <ChevronRight className="w-5 h-5 inline-block ml-2" />
              </button>
            </div>

          </>
        )}

        {/* STEP 5 — CONFIRMAÇÃO */}
        {step === 5 && (
          <div className="flex flex-col items-center">

            <h2 className="text-center text-[2rem] font-semibold text-[#E8DCC3] mb-10">
              Confirme seu Agendamento
            </h2>

            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-8 shadow-xl max-w-xl w-full mx-auto text-gray-300 space-y-6">

              <div className="flex items-center gap-4">
                <img
                  src={
                    selectedProfessional?.image_url ??
                    "https://via.placeholder.com/100"
                  }
                  className="w-20 h-20 rounded-xl object-cover border border-[#3a3a3a]"
                />
                <div>
                  <h3 className="text-[#E8DCC3] text-xl font-medium">
                    {selectedProfessional?.name}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {selectedProfessional?.specialty}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-6 space-y-3 text-sm">

                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#D6C6AA]" /> Data
                  </span>
                  <span className="text-white">
                    {selectedDate} de{" "}
                    {currentMonth.toLocaleDateString("pt-BR", {
                      month: "long",
                    })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#D6C6AA]" /> Horário
                  </span>
                  <span className="text-white">{selectedTime}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D6C6AA]" /> Serviço
                  </span>
                  <span className="text-white">
                    {selectedService?.name}
                  </span>
                </div>

                {selectedService?.duration_minutes && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Timer className="w-4 h-4 text-[#D6C6AA]" /> Duração
                    </span>
                    <span className="text-white">
                      {selectedService.duration_minutes} min
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#D6C6AA]" /> Valor
                  </span>
                  <span className="text-white">
                    R$ {formatCurrency(Number(selectedService?.price ?? 0))}
                  </span>
                </div>

{(selectedService?.discount_percent ?? 0) > 0 && (
  <div className="text-right text-xs text-gray-400">
    com desconto: R${" "}
    {formatCurrency(
      applyDiscount(
        Number(selectedService?.price ?? 0),
        selectedService?.discount_percent ?? 0
      )
    )}{" "}
    ({selectedService?.discount_percent}%)
  </div>
)}


                <div className="flex justify-between pt-4 border-t border-[#2a2a2a]">
                  <span className="text-gray-400 flex items-center gap-2">
                    <User2 className="w-4 h-4 text-[#D6C6AA]" /> Cliente
                  </span>
                  <span className="text-white">{formData.nome}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Telefone</span>
                  <span className="text-white">{formData.telefone}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">E-mail</span>
                  <span className="text-white">{formData.email}</span>
                </div>

                <div className="pt-4 border-t border-[#2a2a2a] text-center">
                  {paymentPolicy === "none" ? (
                    <p className="text-[#E8DCC3] text-lg font-semibold">
                      Sem pagamento antecipado
                    </p>
                  ) : (
                    <p className="text-[#E8DCC3] text-lg font-semibold">
                      A pagar agora: R$ {formatCurrency(amountDue)}
                    </p>
                  )}
                </div>

              </div>
            </div>
<div
  className="
    max-w-xl w-full mx-auto 
    flex justify-between items-center
    mt-10 gap-3
  "
>
  <button
    onClick={() => setStep(4)}
    className="text-gray-400 hover:text-[#E8DCC3] transition flex items-center gap-2 text-sm"
  >
    <ChevronLeft className="w-5 h-5" /> Voltar
  </button>

  <button
    onClick={handleSubmitBooking}
    disabled={loading}
    className="
      bg-[#E8DCC3] text-black font-semibold 
      px-5 py-3 
      rounded-xl 
      hover:bg-[#f3ead6]
      transition disabled:opacity-40
      text-sm
    "
  >
    {loading ? "Processando..." : "Confirmar Agendamento"}
  </button>
</div>
</div>
        )}

        {error && (
          <p className="text-red-500 mt-4 text-center">
            {error}
          </p>
        )}

        {bookingSuccess && (
          <p className="text-green-500 mt-4 text-center">
            Agendamento criado com sucesso!
          </p>
        )}

      </div>
    </main>
  );
}
