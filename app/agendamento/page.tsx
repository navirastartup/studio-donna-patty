"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase"; // Importa o cliente Supabase
import { useRouter } from 'next/navigation'; // Importar useRouter

interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url?: string; // Optional image URL
}

interface Professional {
  id: string;
  name: string;
  specialty: string;
  image_url?: string; // Optional image URL
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

// Remover timeSlots fixos
// const timeSlots = [
//   "08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"
// ];

// Remover unavailableDates fixos
// const unavailableDates = [1, 2, 5, 6, 8, 12, 13, 15, 19, 20, 22, 26, 27];

export default function AgendamentoPage() {
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    servico: "",
    profissional: "", // Adicionado campo para profissional
  });
  const [services, setServices] = useState<Service[]>([]); // Estado para serviços do Supabase
  const [professionals, setProfessionals] = useState<Professional[]>([]); // Estado para profissionais do Supabase
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null); // Pode ser nulo inicialmente
  const [selectedTime, setSelectedTime] = useState<string | null>(null); // Pode ser nulo inicialmente
  const [currentMonth, setCurrentMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth())); // Mês atual
  const [step, setStep] = useState(1); // 1: Serviço, 2: Profissional, 3: Data/Hora, 4: Dados, 5: Confirmação
  const [bookingSuccess, setBookingSuccess] = useState(false); // Estado para sucesso do agendamento
  const [availableSchedules, setAvailableSchedules] = useState<Schedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]); // Horários dinâmicos
  const [requirePaymentUpfront, setRequirePaymentUpfront] = useState(true); // Default
  const router = useRouter(); // Inicializar useRouter

  // Variáveis calculadas
  const selectedService = services.find(s => s.id === formData.servico);
  const selectedProfessional = professionals.find(p => p.id === formData.profissional);

  // Efeito para buscar serviços, profissionais, horários e configurações do Supabase
  useEffect(() => {
    async function fetchSupabaseData() {
      setLoading(true);
      setError(null);
      try {
        // Buscar serviços
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, name, description, price, image_url');
        if (servicesError) throw servicesError;
        setServices(servicesData as Service[]);

        // Buscar profissionais
        const { data: professionalsData, error: professionalsError } = await supabase
          .from('professionals')
          .select('id, name, specialty, image_url, bio');
        if (professionalsError) throw professionalsError;
        setProfessionals(professionalsData as Professional[]);

        // Buscar horários disponíveis
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('schedules')
          .select('*');
        if (schedulesError) throw schedulesError;
        setAvailableSchedules(schedulesData as Schedule[]);

        // Buscar configurações globais
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('key, value')
          .eq('key', 'require_payment_upfront')
          .single();
        if (!settingsError && settingsData?.value !== undefined) {
          setRequirePaymentUpfront(settingsData.value);
        }

      } catch (err: any) {
        console.error("Erro ao buscar dados do Supabase:", err);
        setError(err.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchSupabaseData();
  }, []);

  // Efeito para recalcular timeSlots quando a data selecionada ou o profissional mudar
  useEffect(() => {
    if (selectedDate && selectedProfessional) {
      const dayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), selectedDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const professionalSchedule = availableSchedules.find(s =>
        s.day_of_week === dayOfWeek && (!s.professional_id || s.professional_id === selectedProfessional.id)
      );

      if (professionalSchedule) {
        const newTimeSlots: string[] = [];
        const startHour = parseInt(professionalSchedule.start_time.substring(0, 2));
        const endHour = parseInt(professionalSchedule.end_time.substring(0, 2));
        const breakStartHour = professionalSchedule.break_start_time ? parseInt(professionalSchedule.break_start_time.substring(0, 2)) : -1;
        const breakEndHour = professionalSchedule.break_end_time ? parseInt(professionalSchedule.break_end_time.substring(0, 2)) : -1;

        for (let hour = startHour; hour < endHour; hour++) {
          if (!(hour >= breakStartHour && hour < breakEndHour)) {
            newTimeSlots.push(`${String(hour).padStart(2, '0')}:00`);
          }
        }
        setTimeSlots(newTimeSlots);
      } else {
        setTimeSlots([]); // Nenhum horário disponível para este dia/profissional
      }
    } else {
      setTimeSlots([]);
    }
  }, [selectedDate, selectedProfessional, availableSchedules, currentMonth]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateSelect = (day: number) => {
    const fullDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Assegurar que selectedProfessional é passado como dependência para este hook, ou acessado diretamente no escopo
    const dayOfWeek = fullDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hasSchedule = availableSchedules.some(s => s.day_of_week === dayOfWeek && (!s.professional_id || s.professional_id === selectedProfessional?.id));
    
    if (!hasSchedule || fullDate < new Date(new Date().setHours(0, 0, 0, 0))) { // Desabilitar datas passadas ou sem horários
      return; 
    }
    setSelectedDate(day);
    setSelectedTime(null); // Resetar horário ao mudar a data
  };

  // Função para lidar com o envio do agendamento
  const handleSubmitBooking = async () => {
    setError(null);
    setLoading(true);
    setBookingSuccess(false);

    if (!selectedService || !selectedProfessional || !selectedDate || !selectedTime || !formData.nome || !formData.telefone || !formData.email) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      setLoading(false);
      return;
    }

    try {
      // 1. Verificar/Criar Cliente
      let clientId: string;
      const { data: existingClients, error: clientFetchError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', formData.email)
        .limit(1);

      if (clientFetchError) throw clientFetchError;

      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id; // Cliente existente
      } else {
        // Criar novo cliente
        const { data: newClient, error: newClientError } = await supabase
          .from('clients')
          .insert({
            full_name: formData.nome,
            phone: formData.telefone,
            email: formData.email,
          })
          .select('id')
          .single();

        if (newClientError) throw newClientError;
        if (!newClient) throw new Error("Falha ao criar novo cliente.");
        clientId = newClient.id; // Novo cliente criado
      }

      // 2. Criar Agendamento
      const appointmentDateTime = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        selectedDate,
        parseInt(selectedTime.split(':')[0]), // Hora
        parseInt(selectedTime.split(':')[1])  // Minuto
      );
      const endDateTime = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000); // 1 hora de duração (exemplo)

      const { error: appointmentError } = await supabase.from('appointments').insert({
        service_id: selectedService.id,
        professional_id: selectedProfessional.id,
        client_id: clientId,
        start_time: appointmentDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: 'pending', // Status inicial
        payment_status: requirePaymentUpfront ? 'pending' : 'not_required', // Status de pagamento baseado na configuração
      });

      if (appointmentError) throw appointmentError;

      setBookingSuccess(true);
      // Opcional: Redirecionar para uma página de confirmação ou para o dashboard do cliente
      router.push('/agendamento/sucesso'); // Exemplo de redirecionamento

    } catch (err: any) {
      console.error("Erro ao processar agendamento:", err);
      setError(err.message || "Erro inesperado ao agendar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 5; // Serviço, Profissional, Data/Hora, Dados, Confirmação

  if (loading && !bookingSuccess) {
    return (
      <main className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center justify-center">
        <p className="text-[#D6C6AA] text-xl">Carregando dados...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center justify-center">
        <p className="text-red-500 text-xl">Erro: {error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[#D6C6AA] mb-12 text-center">
          Agende seu horário
        </h1>

        {/* Indicador de Etapas */}
        <div className="flex justify-center items-center gap-4 mb-12">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
            <div
              key={s}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300
                ${s === step ? 'bg-[#D6C6AA] text-black' : 'bg-gray-700 text-gray-400'}
                ${s < step ? 'bg-green-600 text-white' : ''}
              `}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Conteúdo por Etapa */}
        <div className="bg-gray-900 rounded-xl shadow-lg p-6 md:p-10">
          {/* Etapa 1: Seleção de Serviço */}
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
                      handleInputChange("servico", service.id);
                      setStep(2); // Avança para seleção de profissional
                    }}
                    className={`
                      relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200
                      ${formData.servico === service.id
                        ? 'border-[#D6C6AA] scale-105 shadow-xl'
                        : 'border-gray-700 hover:border-gray-500'
                      }
                      bg-gray-800
                    `}
                  >
                    <div className="w-full h-32 bg-gray-700 rounded-md mb-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={service.image_url || "https://via.placeholder.com/300x200/2a2a2a/d6c6aa?text=Serviço"}
                        alt={service.name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <span className="text-lg font-medium text-white">{service.name}</span>
                    <span className="text-[#D6C6AA] font-bold">R$ {service.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Etapa 2: Seleção de Profissional */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-8 text-center">
                Escolha o Profissional
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {professionals.map((professional) => (
                  <button
                    key={professional.id}
                    onClick={() => {
                      handleInputChange("profissional", professional.id);
                      setStep(3); // Avança para seleção de data/hora
                    }}
                    className={`
                      relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200
                      ${formData.profissional === professional.id
                        ? 'border-[#D6C6AA] scale-105 shadow-xl'
                        : 'border-gray-700 hover:border-gray-500'
                      }
                      bg-gray-800
                    `}
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border-2 border-gray-600">
                      <img
                        src={professional.image_url || "https://via.placeholder.com/150/2a2a2a/d6c6aa?text=Pro"}
                        alt={professional.name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <span className="text-lg font-medium text-white">{professional.name}</span>
                    <span className="text-sm text-gray-400">{professional.specialty}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(1)} className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5" /> Voltar
                </button>
              </div>
            </div>
          )}

          {/* Etapa 3: Seleção de Data e Horário */}
          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-6">
                  Selecione Data e Horário
                </h2>
                {/* Calendário */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-semibold text-[#D6C6AA]">
                      {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(" de", "").replace(/\s\d{4}$/, '')}
                    </h3>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-gray-400">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                      <div key={day} className="py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {/* Preenchimento dos dias vazios no início do mês */}
                    {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }, (_, i) => (
                      <div key={`empty-start-${i}`} className="p-2"></div>
                    ))}
                    {/* Dias do mês */}
                    {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map((day) => {
                      const fullDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                      const isToday = fullDate.toDateString() === new Date().toDateString();
                      // Modificar isDisabled para verificar horários disponíveis dinamicamente
                      const dayOfWeek = fullDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                      const hasSchedule = availableSchedules.some(s => s.day_of_week === dayOfWeek && (!s.professional_id || s.professional_id === selectedProfessional?.id));

                      const isDisabled = !hasSchedule || fullDate < new Date(new Date().setHours(0, 0, 0, 0)); // Desabilita datas passadas

                      return (
                        <button
                          key={day}
                          onClick={() => handleDateSelect(day)}
                          disabled={isDisabled}
                          className={`
                            p-2 rounded-lg text-sm transition-all duration-200 aspect-square flex items-center justify-center
                            ${isDisabled
                              ? 'text-gray-600 cursor-not-allowed bg-gray-800 opacity-50' // Adiciona opacidade para desabilitados
                              : selectedDate === day
                              ? 'bg-[#D6C6AA] text-black font-semibold shadow-md'
                              : isToday
                              ? 'border border-[#D6C6AA] text-[#D6C6AA] hover:bg-gray-700'
                              : 'text-gray-300 hover:bg-gray-700'
                            }
                          `}
                        >
                          {day}
                        </button>
                      );
                    })}
                    {/* Preenchimento dos dias vazios no final do mês (opcional, para manter o grid) */}
                    {Array.from({ length: 6 - new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDay() }, (_, i) => (
                      <div key={`empty-end-${i}`} className="p-2"></div>
                    ))}
                  </div>
                </div>

                {/* Horário */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Horário
                  </label>
                  <select
                    value={selectedTime || ""}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#D6C6AA] transition-colors appearance-none cursor-pointer"
                    disabled={timeSlots.length === 0} // Desabilita se não houver horários
                  >
                    <option value="" disabled>Selecione um horário</option>
                    {timeSlots.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resumo da Etapa 3 */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-xl font-semibold text-[#D6C6AA] mb-4">
                  Detalhes do Agendamento
                </h4>
                <div className="space-y-3 text-sm">
                  {selectedService && <p><span className="text-gray-400">Serviço:</span> <span className="text-white">{selectedService.name} (R$ {selectedService.price})</span></p>}
                  {selectedProfessional && <p><span className="text-gray-400">Profissional:</span> <span className="text-white">{selectedProfessional.name}</span></p>}
                  {selectedDate && selectedTime && (
                    <p><span className="text-gray-400">Data e Hora:</span> <span className="text-white">{selectedDate} de {currentMonth.toLocaleDateString('pt-BR', { month: 'long' })} às {selectedTime}</span></p>
                  )}
                  {!selectedDate && <p className="text-gray-500">Selecione uma data</p>}
                  {!selectedTime && <p className="text-gray-500">Selecione um horário</p>}
                </div>
                <div className="flex justify-between mt-8">
                  <button onClick={() => setStep(2)} className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2">
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

          {/* Etapa 4: Dados Pessoais */}
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
                <button onClick={() => setStep(3)} className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5" /> Voltar
                </button>
                <button
                  onClick={() => setStep(5)} // Avança para confirmação/pagamento
                  disabled={!formData.nome || !formData.telefone || !formData.email}
                  className="bg-[#D6C6AA] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Revisar e Pagar <ChevronRight className="w-5 h-5 inline-block ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Etapa 5: Confirmação e Pagamento */}
          {step === 5 && (
            <div>
              <h2 className="text-2xl font-semibold text-[#D6C6AA] mb-6 text-center">
                Confirme seu Agendamento
              </h2>
              <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto space-y-4">
                <h3 className="text-xl font-semibold text-[#D6C6AA] mb-4">Detalhes:</h3>
                <p><span className="text-gray-400">Serviço:</span> <span className="text-white">{selectedService?.name}</span></p>
                <p><span className="text-gray-400">Profissional:</span> <span className="text-white">{selectedProfessional?.name}</span></p>
                <p><span className="text-gray-400">Data:</span> <span className="text-white">{selectedDate} de {currentMonth.toLocaleDateString('pt-BR', { month: 'long' })}</span></p>
                <p><span className="text-gray-400">Horário:</span> <span className="text-white">{selectedTime}</span></p>
                <p><span className="text-gray-400">Nome:</span> <span className="text-white">{formData.nome}</span></p>
                <p><span className="text-gray-400">Telefone:</span> <span className="text-white">{formData.telefone}</span></p>
                <p><span className="text-gray-400">E-mail:</span> <span className="text-white">{formData.email}</span></p>
                <p className="text-2xl font-bold text-[#D6C6AA] mt-6">Total: R$ {selectedService?.price}</p>
              </div>

              <div className="flex justify-between mt-8 max-w-lg mx-auto">
                <button onClick={() => setStep(4)} className="text-gray-400 hover:text-[#D6C6AA] transition-colors flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5" /> Voltar
                </button>
                <button
                  // Lógica de pagamento será adicionada aqui
                  disabled={!selectedService || !selectedProfessional || !selectedDate || !selectedTime || !formData.nome || !formData.telefone || !formData.email || loading}
                  onClick={handleSubmitBooking}
                  className="bg-[#D6C6AA] text-black font-semibold px-8 py-4 rounded-lg hover:bg-[#e5d8c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loading ? "Processando..." : (requirePaymentUpfront ? "Pagar para Agendar" : "Confirmar Agendamento")}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
