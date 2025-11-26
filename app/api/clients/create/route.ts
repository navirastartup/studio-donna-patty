import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { full_name, phone, email } = await req.json();

    if (!full_name || full_name.trim().length < 2) {
      return NextResponse.json(
        { error: "O nome do cliente é obrigatório." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({
        full_name: full_name.trim(),
        phone: phone || null,
        email: email || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar cliente:", error);
      return NextResponse.json(
        { error: "Erro ao criar cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, client: data });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
