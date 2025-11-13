"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // Para mensagens de sucesso/erro do reset
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Remover logs de depuração antigos
    // console.log('Login Page: Calling signInWithPassword with email:', email);
    // console.log('Login Page: Supabase client object:', supabase);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError(error.message);
      console.error("Login Page: Erro de login:", error.message);
    } else {
      console.log("Login bem-sucedido! Redirecionando...");
      // Remover logs de depuração antigos
      // console.log("Login Page: Login bem-sucedido! Data:", data);
      // console.log("Login Page: localStorage after successful login:", localStorage.getItem('sb-' + data.session.access_token.split('.')[1] + '-auth-token'));
      // console.log("Login Page: Supabase client session after login:", clientSession);

      router.push("/admin");
      // Remover logs de depuração antigos
      // console.log("Login Page: Cookies after successful login:", document.cookie);
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    if (!email) {
      setError("Por favor, digite seu e-mail para resetar a senha.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`, // Página para o usuário definir nova senha
    });

    if (error) {
      setError(error.message);
      console.error("Erro ao solicitar reset de senha:", error.message);
    } else {
      setMessage("Um e-mail para resetar a senha foi enviado para seu endereço. Verifique sua caixa de entrada.");
      setEmail(""); // Limpa o email
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8 text-center">Login Admin</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
              placeholder="seu@admin.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
              placeholder="Sua senha"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {message && <p className="text-green-500 text-sm text-center">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D6C6AA] text-black px-4 py-3 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && !message ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="text-center mt-4">
          <button
            onClick={handlePasswordReset}
            disabled={loading}
            className="text-gray-400 text-sm hover:text-white transition-colors disabled:opacity-50"
          >
            Esqueceu a senha?
          </button>
        </div>
      </div>
    </main>
  );
}
