"use client";
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null); // Track session directly
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Função para verificar a sessão atual
    async function checkSession() {
      console.log("AdminLayout: Verificando sessão...");
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("AdminLayout: Erro ao obter sessão:", error);
        setSession(null);
      } else {
        console.log("AdminLayout: Sessão atual (checkSession):", currentSession);
        setSession(currentSession);
      }
      setLoading(false);
    }

    checkSession();

    // Listener para mudanças no estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log("AdminLayout: authStateChange event, nova sessão:", newSession);
      setSession(newSession);
      setLoading(false); // Garante que loading seja false após qualquer mudança de sessão
      // Se a sessão sumir, redireciona para o login
      if (!newSession) {
        console.log("AdminLayout: Nenhuma sessão, redirecionando para /login");
        router.push('/login');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    console.log("AdminLayout: Carregando...");
    return (
      <div className="flex min-h-screen bg-gray-950 text-white items-center justify-center">
        <p className="text-[#D6C6AA] text-xl">Carregando Painel Administrativo...</p>
      </div>
    );
  }

  // Se não está carregando e não há sessão, o middleware já deve ter redirecionado.
  // Não renderizamos nada aqui para evitar flashes de conteúdo não autorizado ou redirecionamentos no cliente.
  if (!session) {
    console.log("AdminLayout: Nenhuma sessão, retornando null (middleware deve lidar com redirecionamento)");
    return null; 
  }

  console.log("AdminLayout: Sessão ativa, renderizando conteúdo.");
  // Se autenticado, renderiza o layout do admin
  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-6 space-y-6">
        <div className="text-2xl font-bold text-[#D6C6AA]">Admin MS</div>
        <nav className="space-y-3">
          <a href="/admin" className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            Dashboard
          </a>
          <a href="/admin/servicos" className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            Serviços
          </a>
          <a href="/admin/profissionais" className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            Profissionais
          </a>
          <a href="/admin/agendamentos" className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            Agendamentos
          </a>
          <a href="/admin/clientes" className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            Clientes
          </a>
          <a href="/admin/configuracoes" className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            Configurações
          </a>
        </nav>
        {/* Logout button */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/login');
          }}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors mt-8"
        >
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-auto">
        {children}
      </div>
    </div>
  );
}
