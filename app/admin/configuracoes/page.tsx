"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Clock, CalendarDays, Loader2, KeyRound, Palette } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

interface Schedule {
  id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  break_start_time?: string | null;
  break_end_time?: string | null;
  professional_id?: string | null; // Pode ser null para horários gerais
}

interface Setting {
  id?: string;
  key: string;
  value: any;
}

const DAYS_OF_WEEK = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

const DAY_NAMES: { [key: string]: string } = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function AdminConfiguracoesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [systemName, setSystemName] = useState("");
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);
  const [requirePaymentUpfront, setRequirePaymentUpfront] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // Fetch Schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (scheduleError) throw scheduleError;
      const existingSchedules = new Map(scheduleData.map(s => [s.day_of_week, s]));
      const initialSchedules = DAYS_OF_WEEK.map(day => {
        if (existingSchedules.has(day)) {
          return existingSchedules.get(day)!;
        } else {
          return { day_of_week: day, start_time: "09:00", end_time: "18:00", break_start_time: null, break_end_time: null };
        }
      });
      setSchedules(initialSchedules);

      // Fetch Settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('key, value');
      if (settingsError) throw settingsError;

      settingsData.forEach(setting => {
        if (setting.key === 'system_name') setSystemName(setting.value);
        if (setting.key === 'system_logo_url') setSystemLogoUrl(setting.value);
        if (setting.key === 'require_payment_upfront') setRequirePaymentUpfront(setting.value);
      });

    } catch (err: any) {
      console.error("Erro ao carregar dados de configuração:", err);
      setError("Falha ao carregar dados de configuração: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleScheduleChange = (day: string, field: keyof Schedule, value: string | null) => {
    setSchedules(prevSchedules =>
      prevSchedules.map(s =>
        s.day_of_week === day ? { ...s, [field]: value } : s
      )
    );
    setSuccessMessage(null);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSuccessMessage(null);
    if (key === 'system_name') setSystemName(value);
    if (key === 'system_logo_url') setSystemLogoUrl(value);
    if (key === 'require_payment_upfront') setRequirePaymentUpfront(value);
  };

  const handleSaveSchedules = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      for (const schedule of schedules) {
        if (schedule.id) {
          const { error: updateError } = await supabase
            .from('schedules')
            .update({
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              break_start_time: schedule.break_start_time || null,
              break_end_time: schedule.break_end_time || null,
            })
            .eq('id', schedule.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('schedules')
            .insert({
              day_of_week: schedule.day_of_week,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              break_start_time: schedule.break_start_time || null,
              break_end_time: schedule.break_end_time || null,
            });
          if (insertError) throw insertError;
        }
      }
      setSuccessMessage("Horários salvos com sucesso!");
      fetchData(); // Refetch all data to ensure state is consistent
    } catch (err: any) {
      console.error("Erro ao salvar horários:", err);
      setError("Falha ao salvar horários: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updates = [
        { key: 'system_name', value: systemName },
        { key: 'system_logo_url', value: systemLogoUrl },
        { key: 'require_payment_upfront', value: requirePaymentUpfront },
      ];

      for (const update of updates) {
        // Tentar atualizar, se não existir, inserir
        const { error: upsertError } = await supabase
          .from('settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
        if (upsertError) throw upsertError;
      }
      setSuccessMessage("Configurações gerais salvas com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar configurações gerais:", err);
      setError("Falha ao salvar configurações gerais: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Por favor, preencha todos os campos de senha.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("A nova senha e a confirmação não coincidem.");
      setLoading(false);
      return;
    }

    try {
      // Supabase Auth update user password (requires re-authentication usually)
      // Para mudar a senha de um usuário logado, Supabase Auth espera que a sessão seja válida
      const { error: updatePasswordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updatePasswordError) throw updatePasswordError;

      setSuccessMessage("Senha alterada com sucesso! Você pode precisar fazer login novamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      console.error("Erro ao mudar a senha:", err);
      setError("Falha ao mudar a senha: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando configurações...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8">Configurações</h2>

      {/* Mensagens de Sucesso/Erro */} 
      {successMessage && (
        <div className="bg-green-800 text-white p-3 rounded-lg flex items-center gap-2 mb-6">
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-800 text-white p-3 rounded-lg flex items-center gap-2 mb-6">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Seção de Configurações Gerais (Nome, Logo, Pagamento Adiantado) */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Palette className="w-6 h-6 text-[#D6C6AA]" /> Configurações Gerais
        </h3>
        <p className="text-gray-400 mb-6">Defina o nome, logo do sistema e opções de agendamento.</p>

        <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
          {/* Campo Nome do Sistema */}
          <div>
            <label htmlFor="system_name" className="block text-sm font-medium text-gray-300 mb-2">Nome do Sistema</label>
            <input
              type="text"
              id="system_name"
              value={systemName}
              onChange={(e) => handleSettingChange('system_name', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
              required
            />
          </div>

          {/* Campo Logo do Sistema */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Logo do Sistema</label>
            <ImageUpload
              initialImageUrl={systemLogoUrl}
              onUploadSuccess={url => handleSettingChange('system_logo_url', url)}
              onRemove={() => handleSettingChange('system_logo_url', null)}
              bucketName="images"
              disabled={loading} // Desabilita o upload enquanto salva
            />
          </div>

          {/* Opção de Pagamento Adiantado */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="require_payment_upfront"
              checked={requirePaymentUpfront}
              onChange={(e) => handleSettingChange('require_payment_upfront', e.target.checked)}
              className="form-checkbox h-5 w-5 text-[#D6C6AA] bg-gray-700 border-gray-600 rounded focus:ring-[#D6C6AA]"
              disabled={loading}
            />
            <label htmlFor="require_payment_upfront" className="text-sm font-medium text-gray-300">Exigir Pagamento Adiantado no Agendamento</label>
          </div>

          <div className="flex justify-end mt-6">
            <button
              type="submit"
              className="bg-[#D6C6AA] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Salvar Configurações Gerais
            </button>
          </div>
        </form>
      </div>

      {/* Seção de Horários Disponíveis */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-[#D6C6AA]" /> Dias e Horários Disponíveis
        </h3>
        <p className="text-gray-400 mb-6">Defina os horários de funcionamento e pausas para cada dia da semana.</p>

        <form onSubmit={handleSaveSchedules} className="space-y-6">
          {schedules.map(schedule => (
            <div key={schedule.day_of_week} className="bg-gray-800 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-3">{DAY_NAMES[schedule.day_of_week]}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor={`${schedule.day_of_week}-start`} className="block text-sm font-medium text-gray-300 mb-1">Início</label>
                  <input
                    type="time"
                    id={`${schedule.day_of_week}-start`}
                    value={schedule.start_time || ""}
                    onChange={(e) => handleScheduleChange(schedule.day_of_week, "start_time", e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-[#D6C6AA]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`${schedule.day_of_week}-end`} className="block text-sm font-medium text-gray-300 mb-1">Fim</label>
                  <input
                    type="time"
                    id={`${schedule.day_of_week}-end`}
                    value={schedule.end_time || ""}
                    onChange={(e) => handleScheduleChange(schedule.day_of_week, "end_time", e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-[#D6C6AA]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`${schedule.day_of_week}-break-start`} className="block text-sm font-medium text-gray-300 mb-1">Pausa Início</label>
                  <input
                    type="time"
                    id={`${schedule.day_of_week}-break-start`}
                    value={schedule.break_start_time || ""}
                    onChange={(e) => handleScheduleChange(schedule.day_of_week, "break_start_time", e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-[#D6C6AA]"
                  />
                </div>
                <div>
                  <label htmlFor={`${schedule.day_of_week}-break-end`} className="block text-sm font-medium text-gray-300 mb-1">Pausa Fim</label>
                  <input
                    type="time"
                    id={`${schedule.day_of_week}-break-end`}
                    value={schedule.break_end_time || ""}
                    onChange={(e) => handleScheduleChange(schedule.day_of_week, "break_end_time", e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-[#D6C6AA]"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end mt-6">
            <button
              type="submit"
              className="bg-[#D6C6AA] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Salvar Horários
            </button>
          </div>
        </form>
      </div>

      {/* Seção de Mudar Senha do Admin */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-[#D6C6AA]" /> Mudar Senha
        </h3>
        <p className="text-gray-400 mb-6">Altere sua senha de administrador.</p>

        <form onSubmit={handleChangePassword} className="space-y-6">
          {/* Campo Senha Atual */}
          <div>
            <label htmlFor="current_password" className="block text-sm font-medium text-gray-300 mb-2">Senha Atual</label>
            <input
              type="password"
              id="current_password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
              required
            />
          </div>

          {/* Campo Nova Senha */}
          <div>
            <label htmlFor="new_password" className="block text-sm font-medium text-gray-300 mb-2">Nova Senha</label>
            <input
              type="password"
              id="new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
              required
            />
          </div>

          {/* Campo Confirmar Nova Senha */}
          <div>
            <label htmlFor="confirm_new_password" className="block text-sm font-medium text-gray-300 mb-2">Confirmar Nova Senha</label>
            <input
              type="password"
              id="confirm_new_password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
              required
            />
          </div>

          <div className="flex justify-end mt-6">
            <button
              type="submit"
              className="bg-[#D6C6AA] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Mudar Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
