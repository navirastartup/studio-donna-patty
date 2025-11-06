"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";


interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  image_url?: string | null;
  duration_minutes?: number | null; // ✅ adiciona aqui
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
  // dados
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<Schedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // seleções
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // form
  const [formData, setFormData] = useState({ nome: "", telefone: "", email: "" });

  // UI
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  // settings — pagamentos
  const [paymentPolicy, setPaymentPolicy] = useState<PaymentPolicy>("full");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("percent");
  const [paymentValue, setPaymentValue] = useState<number>(30);

  const totalSteps = 5;
  const [step, setStep] = useState<number>(1);

  const handleInputChange = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name, description, price, image_url, duration_minutes"); // ✅ inclui duração      
        if (servicesError) throw servicesError;
        setServices((servicesData as Service[]) || []);

        const { data: profData, error: profError } = await supabase
          .from("professionals")
          .select("id, name, specialty, image_url, bio");
        if (profError) throw profError;
        setProfessionals((profData as Professional[]) || []);

        const { data: schedulesData, error: schedulesError } = await supabase
          .from("schedules")
          .select("*");
        if (schedulesError) throw schedulesError;
        setAvailableSchedules((schedulesData as Schedule[]) || []);

        const { data: settingsData, error: settingsError } = await supabase
          .from("settings")
          .select("key, value");
        if (!settingsError && settingsData) {
          const getVal = (k: string, def?: any) =>
            settingsData.find((s: any) => s.key === k)?.value ?? def;

          setPaymentPolicy(getVal("payment_policy", "full"));
          setPaymentMode(getVal("payment_mode", "percent"));
          setPaymentValue(Number(getVal("payment_value", 30)));
        }
      } catch (err: any) {
        console.error("Erro ao buscar dados:", err);
        setError(err?.message || "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // slots considerando agendamentos existentes
  useEffect(() => {
    const fetchAvailableSlots = async (): Promise<void> => {
      if (!selectedDate || !selectedProfessional) {
        setTimeSlots([]);
        return;
      }
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
          (s: Schedule) =>
            s.day_of_week.toLowerCase() === dayOfWeek &&
            (!s.professional_id || s.professional_id === selectedProfessional.id)
        );
        if (!schedule) {
          setTimeSlots([]);
          return;
        }
  
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
  
        const { data: existingAppointments, error } = await supabase
          .from("appointments")
          .select("start_time, end_time")
          .eq("professional_id", selectedProfessional.id)
          .gte("start_time", startOfDay.toISOString())
          .lte("end_time", endOfDay.toISOString());
        if (error) throw error;
  
        const toLocal = (d: string) => {
          const date = new Date(d);
          const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return local.toISOString().slice(11, 16);
        };
  
        const occupied = (existingAppointments ?? []).map((a) => ({
          start: toLocal(a.start_time),
          end: toLocal(a.end_time),
        }));
  
        const duration = Number(selectedService?.duration_minutes ?? 60);
        const step = duration >= 60 ? 60 : 30;
        const toMinutes = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
  
        const isOccupied = (time: string) => {
          const [h, m] = time.split(":").map(Number);
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
            const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            if (h >= breakStartHour && h < breakEndHour) continue;
            if (!isOccupied(t)) slots.push(t);
          }
        }
  
        setTimeSlots(slots);
      } catch (err) {
        console.error("Erro ao buscar horários disponíveis:", err);
        setTimeSlots([]);
      }
    }; // ✅ fecha o fetchAvailableSlots
  
    fetchAvailableSlots(); // ✅ chama a função
  }, [
    selectedDate as number | null,
    selectedProfessional as Professional | null,
    availableSchedules as Schedule[],
    currentMonth as Date,
  ]);
  0
  const firstDayIndex = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const amountDue = useMemo(() => {
    if (!selectedService) return 0;
    const base = parseFloat(selectedService.price || "0");
    if (paymentPolicy === "none") return 0;
    if (paymentPolicy === "full") return base;
    // deposit
    if (paymentMode === "percent") {
      return Math.max(0, Math.round(((base * paymentValue) / 100) * 100) / 100);
    }
    return Math.max(0, Number(paymentValue));
  }, [selectedService, paymentPolicy, paymentMode, paymentValue]);

  async function ensureClient(name: string, email: string, phone: string) {
    // tenta encontrar
    const { data: existing, error: findErr } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .limit(1)
      .single();
    if (findErr && findErr.code !== "PGRST116") throw findErr;

    if (existing?.id) return existing.id;

    const { data: created, error: createErr } = await supabase
      .from("clients")
      .insert({ full_name: name, email, phone })
      .select("id")
      .single();
    if (createErr) throw createErr;
    return created.id;
  }

  const handleDateSelect = (day: number) => {
    const fullDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (fullDate < today) return;

    const dayOfWeek = fullDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const hasSchedule = availableSchedules.some(
      (s) =>
        s.day_of_week.toLowerCase() === dayOfWeek &&
        (!s.professional_id || s.professional_id === selectedProfessional?.id)
    );
    if (!hasSchedule) return;

    setSelectedDate(day);
    setSelectedTime(null);
  };

  const router = useRouter();
  
  async function handleSubmitBooking() {
    setError(null);
    setLoading(true);
    setBookingSuccess(false);
  
    if (
      !selectedService ||
      !selectedProfessional ||
      !selectedDate ||
      !selectedTime ||
      !formData.nome ||
      !formData.telefone ||
      !formData.email
    ) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      setLoading(false);
      return;
    }
  
    try {
      // 1️⃣ Criar ou pegar cliente
      const clientId = await ensureClient(formData.nome, formData.email, formData.telefone);
  
      // 2️⃣ Criar horários
      const [hh, mm] = selectedTime.split(":");
      const startDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        selectedDate,
        Number(hh),
        Number(mm)
      );
      const duration = Number(selectedService?.duration_minutes ?? 60);
      const endDate = new Date(startDate.getTime() + duration * 60 * 1000); // ✅ usa a duração real

  
      // 3️⃣ Verificar conflito de horário
      const checkRes = await supabase
        .from("appointments")
        .select("id")
        .eq("professional_id", selectedProfessional.id)
        .gte("start_time", startDate.toISOString())
        .lt("end_time", endDate.toISOString());
  
      if (checkRes.error) throw checkRes.error;
      if (checkRes.data && checkRes.data.length > 0)
        throw new Error("Horário já reservado. Escolha outro horário.");
  
// 4️⃣ Política sem pagamento (usa rota /api/agendar)
if (paymentPolicy === "none") {
  const res = await fetch("/api/agendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.nome,
      email: formData.email,
      phone: formData.telefone,
      date: `${selectedDate}/${currentMonth.getMonth() + 1}/${currentMonth.getFullYear()}`,
      time: selectedTime,
      service: selectedService.name,
      professional_id: selectedProfessional.id,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao confirmar agendamento.");

  setBookingSuccess(true);
  setStep(5);

  // Feedback visual
  console.log("✅ Confirmações enviadas com sucesso!");
  console.log(data.message || "Notificações disparadas.");

  // 🟢 Redirecionar após 2s
  setTimeout(() => {
    router.push("/success");
  }, 2000);

  return;
}

  
      // 5️⃣ Política com pagamento (depósito ou total)
      const payload = {
        serviceId: selectedService.id,
        professionalId: selectedProfessional.id,
        client: {
          id: clientId,
          name: formData.nome,
          email: formData.email,
          phone: formData.telefone,
        },
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        price: amountDue,
        policy: paymentPolicy, // "deposit" | "full"
      };
  
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      const result = await res.json();
  
      if (!res.ok) throw new Error(result.error || "Erro ao criar preferência de pagamento.");
  
      const initPoint =
        result.init_point ||
        result.preference?.init_point ||
        result.preference?.sandbox_init_point;
  
      // 🟡 Redirecionar para o Mercado Pago
      if (initPoint) {
        window.location.href = initPoint;
        return;
      }
  
      // fallback
      if (result.appointment) {
        setBookingSuccess(true);
        setStep(5);
        setTimeout(() => router.push("/success"), 2000);
        return;
      }
  
      throw new Error("Não foi possível iniciar o pagamento.");
    } catch (err: any) {
      console.error("Erro ao processar agendamento:", err);
      setError(err?.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }
  
  if (loading && !bookingSuccess)
    return (
      <main className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        <p className="text-[#D6C6AA] text-xl">Carregando dados...</p>
      </main>
    );

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[#D6C6AA] mb-12 text-center">
          Agende seu horário
        </h1>

        {/* Passos */}
        <div className="flex justify-center items-center gap-4 mb-12">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300
              ${
                s === step ? "bg-[#D6C6AA] text-black" : "bg-gray-700 text-gray-400"
              } ${s < step ? "bg-green-600 text-white" : ""}`}
            >
              {s}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl shadow-lg p-6 md:p-10">
          {/* Step 1: Serviços */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-8 text-center">
                Selecione o Serviço
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      setSelectedService(service);
                      setStep(2);
                    }}
                    className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedService?.id === service.id
                        ? "border-[#D6C6AA] scale-105 shadow-xl"
                        : "border-gray-700 hover:border-gray-500"
                    } bg-gray-800`}
                  >
                    <div className="w-full h-32 bg-gray-700 rounded-md mb-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={
                          service.image_url ||
                          "https://via.placeholder.com/300x200/2a2a2a/d6c6aa?text=Serviço"
                        }
                        alt={service.name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <span className="text-lg font-medium text-white">{service.name}</span>
                    <span className="text-[#D6C6AA] font-bold">
                      R$ {Number(service.price).toFixed(2).replace(".", ",")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Profissionais */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-8 text-center">
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
                    className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedProfessional?.id === prof.id
                        ? "border-[#D6C6AA] scale-105 shadow-xl"
                        : "border-gray-700 hover:border-gray-500"
                    } bg-gray-800`}
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border-2 border-gray-600">
                      <img
                        src={
                          prof.image_url ||
                          "https://via.placeholder.com/150/2a2a2a/d6c6aa?text=Pro"
                        }
                        alt={prof.name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <span className="text-lg font-medium text-white">{prof.name}</span>
                    <span className="text-sm text-gray-400">{prof.specialty}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Voltar
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Data e Horário */}
          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-6">
                  Selecione Data e Horário
                </h2>
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                        )
                      }
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-semibold text-[#D6C6AA]">
                      {currentMonth
                        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                        .replace(" de", "")
                        .replace(/\s\d{4}$/, "")}
                    </h3>
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                        )
                      }
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-gray-400">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                      <div key={d} className="py-2">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: firstDayIndex }, (_, i) => (
                      <div key={`empty-start-${i}`} className="p-2" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const fullDate = new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth(),
                        day
                      );
                      const isToday = fullDate.toDateString() === new Date().toDateString();
                      const dayOfWeek = fullDate
                        .toLocaleDateString("en-US", { weekday: "long" })
                        .toLowerCase();
                      const hasSchedule = availableSchedules.some(
                        (s) =>
                          s.day_of_week.toLowerCase() === dayOfWeek &&
                          (!s.professional_id || s.professional_id === selectedProfessional?.id)
                      );
                      const isDisabled =
                        !hasSchedule || fullDate < new Date(new Date().setHours(0, 0, 0, 0));
                      return (
                        <button
                          key={day}
                          onClick={() => handleDateSelect(day)}
                          disabled={isDisabled}
                          className={`p-2 rounded-lg text-sm transition-all duration-200 aspect-square flex items-center justify-center ${
                            isDisabled
                              ? "text-gray-600 cursor-not-allowed bg-gray-800 opacity-50"
                              : selectedDate === day
                              ? "bg-[#D6C6AA] text-black font-semibold shadow-md"
                              : isToday
                              ? "border border-[#D6C6AA] text-[#D6C6AA] hover:bg-gray-700"
                              : "text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                    {Array.from(
                      { length: (7 - ((firstDayIndex + daysInMonth) % 7)) % 7 },
                      (_, i) => (
                        <div key={`empty-end-${i}`} className="p-2" />
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Horário</label>
                  <select
                    value={selectedTime || ""}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#D6C6AA] transition-colors appearance-none cursor-pointer"
                    disabled={timeSlots.length === 0}
                  >
                    <option value="" disabled>
                      Selecione um horário
                    </option>
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-xl font-semibold text-[#D6C6AA] mb-4">
                  Detalhes do Agendamento
                </h4>
                <div className="space-y-3 text-sm">
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
                    <>
                      <p className="text-gray-500">Selecione uma data</p>
                      <p className="text-gray-500">Selecione um horário</p>
                    </>
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
                    className="bg-[#D6C6AA] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar <ChevronRight className="w-5 h-5 inline-block ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Dados */}
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
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D6C6AA] transition-colors"
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
                    onChange={(e) => handleInputChange("telefone", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D6C6AA] transition-colors"
                    placeholder="(49) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D6C6AA] transition-colors"
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
                  disabled={!formData.nome || !formData.telefone || !formData.email}
                  className="bg-[#D6C6AA] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Revisar <ChevronRight className="w-5 h-5 inline-block ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmação */}
          {step === 5 && (
            <div>
              <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-6 text-center">
                Confirme seu Agendamento
              </h2>
              <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto space-y-4">
                <h3 className="text-xl font-semibold text-[#D6C6AA] mb-4">Detalhes:</h3>
                <p>
                  <span className="text-gray-400">Serviço:</span>{" "}
                  <span className="text-white">{selectedService?.name}</span>
                </p>
                <p>
                  <span className="text-gray-400">Profissional:</span>{" "}
                  <span className="text-white">{selectedProfessional?.name}</span>
                </p>
                <p>
                  <span className="text-gray-400">Data:</span>{" "}
                  <span className="text-white">
                    {selectedDate} de {currentMonth.toLocaleDateString("pt-BR", { month: "long" })}
                  </span>
                </p>
                <p>
                  <span className="text-gray-400">Horário:</span>{" "}
                  <span className="text-white">{selectedTime}</span>
                </p>
                <p>
                  <span className="text-gray-400">Nome:</span>{" "}
                  <span className="text-white">{formData.nome}</span>
                </p>
                <p>
                  <span className="text-gray-400">Telefone:</span>{" "}
                  <span className="text-white">{formData.telefone}</span>
                </p>
                <p>
                  <span className="text-gray-400">E-mail:</span>{" "}
                  <span className="text-white">{formData.email}</span>
                </p>

                {selectedService?.duration_minutes && (
  <p>
    <span className="text-gray-400">Duração:</span>{" "}
    <span className="text-white">{selectedService.duration_minutes} min</span>
  </p>
)}

                {selectedService && paymentPolicy !== "none" ? (
                  <p className="text-2xl font-bold text-[#D6C6AA] mt-6">
                    A pagar agora: R$ {amountDue.toFixed(2).replace(".", ",")}
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-[#D6C6AA] mt-6">
                    Sem pagamento antecipado
                  </p>
                )}
              </div>

              <div className="flex justify-between mt-8 max-w-lg mx-auto">
                <button
                  onClick={() => setStep(4)}
                  className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Voltar
                </button>
                <button
                  disabled={
                    !selectedService ||
                    !selectedProfessional ||
                    !selectedDate ||
                    !selectedTime ||
                    !formData.nome ||
                    !formData.telefone ||
                    !formData.email ||
                    loading
                  }
                  onClick={handleSubmitBooking}
                  className="bg-[#D6C6AA] text-black font-semibold px-8 py-4 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loading
                    ? "Processando..."
                    : paymentPolicy === "none"
                    ? "Confirmar Agendamento"
                    : paymentPolicy === "deposit"
                    ? `Pagar Sinal (R$ ${amountDue.toFixed(2).replace(".", ",")})`
                    : "Pagar Agora"}
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
      </div>
    </main>
  );
}
