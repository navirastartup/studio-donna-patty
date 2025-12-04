import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { currentPin, newPin } = await req.json();

  if (!currentPin || !newPin) {
    return NextResponse.json(
      { error: "Preencha todos os campos." },
      { status: 400 }
    );
  }

  // Buscar PIN atual nos settings
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", "finance_pin")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "PIN não configurado." },
      { status: 400 }
    );
  }

  const storedPin = data.value;

  // Verificar PIN atual
  if (storedPin !== currentPin) {
    return NextResponse.json(
      { error: "PIN atual incorreto." },
      { status: 401 }
    );
  }

  // Atualizar PIN
  const { error: updateError } = await supabaseAdmin
    .from("settings")
    .update({ value: newPin })
    .eq("key", "finance_pin");

  if (updateError) {
    return NextResponse.json(
      { error: "Erro ao atualizar PIN." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
