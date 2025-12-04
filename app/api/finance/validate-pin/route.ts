import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { pin } = await req.json();

  if (!pin) {
    return NextResponse.json({ ok: false, error: "PIN ausente" }, { status: 400 });
  }

  // pega o PIN gravado no settings
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "finance_pin")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "PIN não configurado" }, { status: 500 });
  }

  const storedPin = data.value;

  if (pin === storedPin) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false });
}
