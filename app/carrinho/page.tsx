"use client";

import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Timer,
  User2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CLIENT_DATA_KEY = "studio-donna-patty-client";

interface Professional {
  id: string;
  name: string;
  specialty?: string | null;
  image_url?: string | null;
}

interface HoursInfo {
  slots: string[];
  closed: boolean;
}

interface HoursCache {
  [key: string]: HoursInfo;
}

// ==========================================================
// Helpers
// ==========================================================
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[2] === "9") {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
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

const formatCurrency = (value: number) =>
  value.toFixed(2).replace(".", ",");

// ==========================================================
// COMPONENTE PRINCIPAL
// ==========================================================
export default function CarrinhoPage() {
  const { cart, updateService, removeService, clearCart } = useCart();
  const router = useRouter();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [hoursCache, setHoursCache] = useState<HoursCache>({});
  
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [closed, setClosed] = useState(false);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [step, setStep] = useState(1); // 1 = configurar serviços, 2 = dados cliente, 3 = revisão
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentItem = cart[currentIndex];

function getBlockedSlotsForClient(currentItemId: string) {
  return cart
    .filter(item =>
      item.id !== currentItemId &&
      item.date &&
      item.time
    )
    .map(item => ({
      date: item.date!,
      time: item.time!,
      duration: item.duration_minutes ?? 60
    }));
}

  // ==========================================================
  // Buscar profissionais
  // ==========================================================
  useEffect(() => {
    async function fetchProfessionals() {
      const { data } = await supabase
        .from("professionals")
        .select("id, name, specialty, image_url");
      setProfessionals((data as Professional[]) || []);
    }
    fetchProfessionals();
  }, []);

  // ==========================================================
  // Carregar dados do cliente
  // ==========================================================
// ==========================================================
// FORMULÁRIO — CARREGAR DADOS AUTOMATICAMENTE SEM DIGITAR NADA
// ==========================================================

// 🔥 Carregar dados salvos + buscar no banco automaticamente
useEffect(() => {
  async function loadClient() {
    if (typeof window === "undefined") return;

    // 1️⃣ Carregar localStorage
    const saved = window.localStorage.getItem(CLIENT_DATA_KEY);
    let local = saved ? JSON.parse(saved) : null;

    if (local) {
      setFormData(local);
    }

    // 2️⃣ Se já tem email salvo → consultar o banco automaticamente
    if (local?.email && local.email.includes("@")) {
      const { data } = await supabase
        .from("clients")
        .select("full_name, phone, email")
        .eq("email", local.email)
        .maybeSingle();

      if (data) {
        setFormData({
          nome: data.full_name || "",
          telefone: formatPhone(data.phone || ""),
          email: data.email,
        });
      }
    }
  }

  loadClient();
}, []);


// 3️⃣ Manter salvo no localStorage
useEffect(() => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLIENT_DATA_KEY, JSON.stringify(formData));
  }
}, [formData]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CLIENT_DATA_KEY, JSON.stringify(formData));
    }
  }, [formData]);

  const handleInputChange = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // ==========================================================
  // Helpers de datas
  // ==========================================================
  const firstDayIndex = useMemo(
    () =>
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
      ).getDay(),
    [currentMonth]
  );

  const daysInMonth = useMemo(
    () =>
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      ).getDate(),
    [currentMonth]
  );

  const selectedDayNumber = useMemo(() => {
    if (!currentItem?.date) return null;
    const [y, m, d] = currentItem.date.split("-").map(Number);
    if (
      y === currentMonth.getFullYear() &&
      m === currentMonth.getMonth() + 1
    ) {
      return d;
    }
    return null;
  }, [currentItem?.date, currentMonth]);

  // ==========================================================
  // Buscar horários
  // ==========================================================
  useEffect(() => {
    async function fetchAvailable() {
      if (
        !currentItem ||
        !currentItem.date ||
        !currentItem.professional_id
      ) {
        setTimeSlots([]);
        setClosed(false);
        return;
      }

      const date = currentItem.date;
      const serviceId = currentItem.service_id;
      const professionalId = currentItem.professional_id;

      const cacheKey = `${serviceId}-${professionalId}-${date}`;

      if (hoursCache[cacheKey]) {
        setTimeSlots(hoursCache[cacheKey].slots);
        setClosed(hoursCache[cacheKey].closed);
        return;
      }

      const res = await fetch("/api/appointments/available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          service_id: serviceId,
          professional_id: professionalId,
        }),
      });

      const data = await res.json();

      const info: HoursInfo = {
        slots: data.available ?? [],
        closed: Boolean(data.closed),
      };

      setHoursCache((prev) => ({ ...prev, [cacheKey]: info }));
      setTimeSlots(info.slots);
      setClosed(info.closed);
    }

    fetchAvailable();
  }, [
    currentItem?.id,
    currentItem?.date,
    currentItem?.professional_id,
    currentMonth,
  ]);

  // ==========================================================
  // Navegação entre serviços
  // ==========================================================
  const allServicesCompleted =
    cart.length > 0 &&
    cart.every((i) => i.professional_id && i.date && i.time);

  function goToNextService() {
    if (currentIndex < cart.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (allServicesCompleted) {
      setStep(2);
    }
  }

  function goToPrevService() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  // ==========================================================
  // Mapa de profissionais
  // ==========================================================
  const profById = useMemo(() => {
    const map: Record<string, Professional> = {};
    for (const p of professionals) map[p.id] = p;
    return map;
  }, [professionals]);

  // ==========================================================
  // ENVIAR TUDO PARA A API FINAL
  // ==========================================================
  async function confirmarAgendamentos() {
    try {
      setError(null);
      setLoading(true);

      if (!allServicesCompleted) {
        setError("Preencha os dados de todos os serviços.");
        return;
      }

      if (
        !formData.nome ||
        !formData.email ||
        !isValidBrazilianPhone(formData.telefone)
      ) {
        setError("Preencha seu nome, telefone e e-mail corretamente.");
        setStep(2);
        return;
      }

      // Montar payload final para API
      const items = cart.map((item) => {
        if (!item.date || !item.time)
          throw new Error("Serviço incompleto.");

        const [hh, mm] = item.time.split(":");
        const [y, m, d] = item.date.split("-").map(Number);

        const duration = item.duration_minutes ?? 60;

        const start = `${item.date}T${hh}:${mm}:00`;

        const endD = new Date(y, m - 1, d, Number(hh), Number(mm));
        endD.setMinutes(endD.getMinutes() + duration);

        const end = `${item.date}T${String(endD.getHours()).padStart(
          2,
          "0"
        )}:${String(endD.getMinutes()).padStart(2, "0")}:00`;

        return {
    service_id: item.service_id,   // ✅ CERTO
    service_name: item.name,
    professional_id: item.professional_id,
    start_time: start,
    end_time: end,
  };
});

      const res = await fetch("/api/agendar-multiplo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            name: formData.nome,
            email: formData.email,
            phone: normalizePhone(formData.telefone),
          },
          items,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        router.push("/failure");
        return;
      }

router.push("/success");
setTimeout(() => clearCart(), 300);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao enviar agendamentos.");
      router.push("/failure");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // PÁGINA VAZIA
  // ==========================================================
  if (cart.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#E8DCC3] px-4">
        <p className="text-xl mb-4">Seu carrinho está vazio.</p>
        <Link
          href="/agendamento"
          className="px-6 py-3 rounded-xl bg-[#E8DCC3] text-black font-semibold hover:bg-[#f3ead6]"
        >
          Voltar para agendar
        </Link>
      </main>
    );
  }

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

        {/* Steps */}
        <div className="flex justify-center items-center gap-3 mb-14">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all ${
                step === s
                  ? "border-[#E8DCC3] text-[#E8DCC3]"
                  : "border-[#ffffff20] text-[#ffffff40]"
              }`}
            >
              {s}
            </div>
          ))}
        </div>

        {/* STEP 1 – Serviços do carrinho */}
        {step === 1 && currentItem && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Lado esquerdo – calendário e horário */}
            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-lg">
              <p className="text-sm text-gray-400 mb-2">
                Serviço {currentIndex + 1} de {cart.length}
              </p>
              <h2 className="text-xl font-semibold text-[#E8DCC3] mb-1">
                {currentItem.name}
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Selecione a data e horário para este serviço.
              </p>

              {/* Profissional */}
              <h3 className="text-sm font-medium text-[#E8DCC3] mb-3">
                Profissional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {professionals.map((prof) => {
                  const selected = currentItem.professional_id === prof.id;
                  return (
                    <button
                      key={prof.id}
                      onClick={() =>
                        updateService(currentItem.id, {
                          professional_id: prof.id,
                          time: null,
                        })
                      }
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                        selected
                          ? "border-[#E8DCC3] bg-[#E8DCC3]/5"
                          : "border-[#2a2a2a] hover:border-[#E8DCC3]/60"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-[#3d3d3d]">
                        <img
                          src={
                            prof.image_url ??
                            "https://via.placeholder.com/100"
                          }
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-white">{prof.name}</p>
                        <p className="text-xs text-gray-400">
                          {prof.specialty}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Calendário */}
              <h3 className="text-sm font-medium text-[#E8DCC3] mb-3">
                Selecione a data
              </h3>

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

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
                {["dom", "seg", "ter", "qua", "qui", "sex", "sab"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2 text-center">
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <span key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                  (day) => {
                    const yyyy = currentMonth.getFullYear();
                    const mm = String(
                      currentMonth.getMonth() + 1
                    ).padStart(2, "0");
                    const dd = String(day).padStart(2, "0");
                    const iso = `${yyyy}-${mm}-${dd}`;
                    const selected = selectedDayNumber === day;

                    return (
                      <button
                        key={day}
                        onClick={() =>
                          updateService(currentItem.id, {
                            date: iso,
                            time: null,
                          })
                        }
                        className={`p-2 rounded-lg text-sm transition ${
                          selected
                            ? "bg-[#E8DCC3] text-black shadow-md"
                            : "text-gray-300 hover:bg-[#272727]"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Horário */}
              <h3 className="mt-6 text-[#E8DCC3] font-medium text-sm">
                Horário
              </h3>

              <div className="flex flex-wrap gap-2 mt-3">
  {closed ? (
    <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
      Fechado neste dia
    </div>
  ) : timeSlots.length > 0 ? (
    timeSlots.map((t) => {
      const blocked = getBlockedSlotsForClient(currentItem.id);

      const isBlocked = blocked.some(b => {
  // 🔒 Só bloquear se for o MESMO profissional
  const otherItem = cart.find(i => i.date === b.date && i.time === b.time);
  if (!otherItem) return false;

  if (otherItem.professional_id !== currentItem.professional_id) {
    return false;
  }

  // Bloqueia se for no mesmo dia
  if (b.date !== currentItem?.date) return false;

  // Mesmo horário exato → bloqueia
  if (b.time === t) return true;

  // Verificar sobreposição de horários
  const [h1, m1] = b.time.split(":").map(Number);
  const [h2, m2] = t.split(":").map(Number);

  const start1 = h1 * 60 + m1;
  const end1 = start1 + b.duration;

  const duration2 = currentItem.duration_minutes ?? 60;
  const start2 = h2 * 60 + m2;
  const end2 = start2 + duration2;

  return start2 < end1 && end2 > start1;
});


      return (
        <div key={t} className="relative group">
          <button
            disabled={isBlocked}
            onClick={() => updateService(currentItem.id, { time: t })}
            className={`px-4 py-2 rounded-full text-sm transition ${
              isBlocked
                ? "bg-[#1b1b1b] text-gray-600 opacity-40 cursor-not-allowed border border-red-400/20"
                : currentItem.time === t
                ? "bg-[#E8DCC3] text-black shadow-lg"
                : "bg-[#1d1d1d] text-gray-300 hover:bg-[#2a2a2a]"
            }`}
          >
            {t}
          </button>

          {/* Tooltip elegante */}
{isBlocked && (
  <div
    className="absolute left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-50
               bg-[#111] text-red-400 text-xs px-2 py-1 rounded-md border border-red-400/40 shadow-lg
               whitespace-nowrap"
  >
    Horário escolhido em outro serviço do carrinho.
  </div>
)}
        </div>
      );
    })
  ) : (
    <p className="text-gray-500 text-sm mt-2">
      Selecione profissional e data para ver os horários.
    </p>
  )}
</div>
            </div>

            {/* Lado direito – resumo do serviço atual + navegação */}
            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h4 className="text-xl font-semibold text-[#E8DCC3] mb-4">
                  Detalhes do Serviço
                </h4>

                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#D6C6AA]" /> Serviço
                    </span>
                    <span className="text-white">{currentItem.name}</span>
                  </div>

                  {currentItem.duration_minutes && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Timer className="w-4 h-4 text-[#D6C6AA]" /> Duração
                      </span>
                      <span className="text-white">
                        {currentItem.duration_minutes} min
                      </span>
                    </div>
                  )}

                  {currentItem.professional_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        Profissional
                      </span>
                      <span className="text-white">
                        {profById[currentItem.professional_id]?.name ??
                          "Selecionado"}
                      </span>
                    </div>
                  )}

                  {currentItem.date && currentItem.time ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-[#D6C6AA]" /> Data
                        e horário
                      </span>
                      <span className="text-white">
                        {currentItem.date.split("-").reverse().join("/")} às{" "}
                        {currentItem.time}
                      </span>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm mt-2">
                      Selecione data e horário.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 gap-3">
                <button
                  onClick={goToPrevService}
                  disabled={currentIndex === 0}
                  className="text-gray-400 hover:text-[#E8DCC3] transition flex items-center gap-2 disabled:opacity-40 text-sm"
                >
                  <ChevronLeft className="w-5 h-5" /> Serviço anterior
                </button>

                <button
                  onClick={goToNextService}
                  disabled={
                    !currentItem.professional_id ||
                    !currentItem.date ||
                    !currentItem.time
                  }
                  className="bg-[#E8DCC3] text-black font-semibold px-6 py-2 rounded-xl hover:bg-[#f3ead6] transition disabled:opacity-40 text-sm"
                >
                  {currentIndex === cart.length - 1
                    ? "Ir para seus dados"
                    : "Próximo serviço"}
                  <ChevronRight className="w-5 h-5 inline-block ml-1" />
                </button>
              </div>

              <button
                onClick={() => removeService(currentItem.id)}
                className="mt-4 text-red-400 text-xs self-end hover:text-red-300"
              >
                Remover este serviço
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 – Dados do cliente */}
        {step === 2 && (
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
                    handleInputChange(
                      "telefone",
                      formatPhone(e.target.value)
                    )
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
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Voltar
              </button>

              <button
                onClick={() => setStep(3)}
                disabled={
                  !formData.nome ||
                  !formData.email ||
                  !isValidBrazilianPhone(formData.telefone)
                }
                className="bg-[#D6C6AA] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50"
              >
                Revisar agendamentos
                <ChevronRight className="w-5 h-5 inline-block ml-2" />
              </button>
            </div>
          </>
        )}

        {/* STEP 3 – Revisão geral */}
        {step === 3 && (
          <div className="flex flex-col items-center">
            <h2 className="text-center text-[2rem] font-semibold text-[#E8DCC3] mb-10">
              Confirme seus Agendamentos
            </h2>

            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-8 shadow-xl max-w-xl w-full mx-auto text-gray-300 space-y-6">
              {cart.map((item, idx) => (
                <div
                  key={item.id + idx}
                  className="border-b border-[#2a2a2a] pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-400">
                      Serviço {idx + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.duration_minutes ?? 60} min
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#D6C6AA]" /> Serviço
                      </span>
                      <span className="text-white">{item.name}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        Profissional
                      </span>
                      <span className="text-white">
                        {item.professional_id
                          ? profById[item.professional_id]?.name ??
                            "Selecionado"
                          : "—"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-[#D6C6AA]" /> Data
                      </span>
                      <span className="text-white">
                        {item.date
                          ? item.date.split("-").reverse().join("/")
                          : "—"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#D6C6AA]" /> Horário
                      </span>
                      <span className="text-white">
                        {item.time ?? "—"}
                      </span>
                    </div>

                    <div className="flex justify-between pt-2">
                      <span className="text-gray-400 flex items-center gap-2">
                        Valor
                      </span>
                      <span className="text-white">
                        R$ {formatCurrency(item.price)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-[#2a2a2a] space-y-2 text-sm">
                <div className="flex justify-between">
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
              </div>
            </div>

            <div className="max-w-xl w-full mx-auto flex justify-between items-center mt-10 gap-3">
              <button
                onClick={() => setStep(2)}
                className="text-gray-400 hover:text-[#E8DCC3] transition flex items-center gap-2 text-sm"
              >
                <ChevronLeft className="w-5 h-5" /> Voltar
              </button>

              <button
                onClick={confirmarAgendamentos}
                disabled={loading || !allServicesCompleted}
                className="bg-[#E8DCC3] text-black font-semibold px-5 py-3 rounded-xl hover:bg-[#f3ead6] transition disabled:opacity-40 text-sm"
              >
                {loading ? "Processando..." : "Confirmar Agendamentos"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-500 mt-4 text-center text-sm">{error}</p>
        )}
      </div>
    </main>
  );
}
