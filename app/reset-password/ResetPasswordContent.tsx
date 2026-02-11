"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function ResetPasswordContent() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 🔐 Valida sessão do link de recuperação
  useEffect(() => {
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setIsReady(true);
      } else {
        setError("Link inválido ou expirado.");
      }
    };

    initSession();
  }, [supabase]);

  // 🔄 Atualiza senha
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("✅ Senha redefinida com sucesso! Redirecionando...");
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    }

    setLoading(false);
  };

  // ⏳ Enquanto valida sessão
  if (!isReady && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Validando link...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-[#D6C6AA] mb-8 text-center">
          Redefinir Senha
        </h2>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-500/20 text-green-400 p-3 rounded mb-4 text-sm">
            {message}
          </div>
        )}

        {isReady && (
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Nova Senha
              </label>
              <input
                type="password"
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-[#D6C6AA]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-[#D6C6AA]"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D6C6AA] text-black font-semibold py-3 rounded hover:opacity-90 transition"
            >
              {loading ? "Redefinindo..." : "Redefinir Senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
