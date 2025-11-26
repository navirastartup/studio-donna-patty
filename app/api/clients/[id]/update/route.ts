import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🔒 apenas no servidor
  { auth: { persistSession: false } }
);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { phone, email, notes } = body;

    const { error } = await supabaseAdmin
      .from("clients")
      .update({
        phone: phone ?? null,
        email: email ?? null,
        notes: notes ?? null,
      })
      .eq("id", params.id);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro interno ao atualizar cliente" },
      { status: 500 }
    );
  }
}
