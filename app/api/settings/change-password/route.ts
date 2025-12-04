import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { current_password, new_password, master_pin } = await req.json();

    if (!current_password || !new_password || !master_pin) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes." },
        { status: 400 }
      );
    }

    // Busca o PIN verdadeiro armazenado
    const { data: pinRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "master_password_pin")
      .single();

    if (!pinRow) {
      return NextResponse.json(
        { error: "PIN mestre não configurado no sistema." },
        { status: 500 }
      );
    }

    const storedPin = pinRow.value;

    // PIN errado → funcionário tentando trocar
    if (String(master_pin) !== String(storedPin)) {
      return NextResponse.json(
        { error: "PIN incorreto. Acesso negado." },
        { status: 403 }
      );
    }

    // Verifica a senha atual no settings
    const { data: passRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_password")
      .single();

    if (!passRow || passRow.value !== current_password) {
      return NextResponse.json(
        { error: "Senha atual incorreta." },
        { status: 401 }
      );
    }

    // Atualiza senha
    await supabase.from("settings").upsert([
      { key: "admin_password", value: new_password }
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Erro alterar senha:", e);
    return NextResponse.json(
      { error: "Erro interno ao alterar senha." },
      { status: 500 }
    );
  }
}
