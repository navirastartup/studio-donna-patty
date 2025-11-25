import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id }: { id: string } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do pagamento é obrigatório" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1) Verifica se o pagamento já está aprovado (bloqueia duplicação)
    const { data: existingPayment, error: checkErr } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Pagamento não encontrado" },
        { status: 404 }
      );
    }

    // Se já estiver aprovado → ignora, mas retorna OK
    if (existingPayment.status === "approved") {
      return NextResponse.json({
        ok: true,
        message: "Pagamento já havia sido aprovado",
      });
    }

    // 2) Atualiza o pagamento (somente se ainda não estiver aprovado)
    const { error: updateErr } = await supabaseAdmin
      .from("payments")
      .update({
        status: "approved",
        payment_date: now,
        updated_at: now,
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("🔥 ERRO mark-paid:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
