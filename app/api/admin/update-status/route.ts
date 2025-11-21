import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function mapPaymentStatus(markPaid: boolean | undefined, incoming?: string | null) {
  if (markPaid === true) return "pago";      // válido
  if (incoming) {
    const v = incoming.toLowerCase();
    if (["pendente", "pending"].includes(v)) return "pendente";
    if (["pago", "paid", "approved"].includes(v)) return "pago";
  }
  return "pendente";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      markPaid,
      method,
      amount,
    }: {
      id: string;
      status: string;
      markPaid?: boolean;
      method?: string;
      amount?: number;
    } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID e status são obrigatórios" },
        { status: 400 }
      );
    }

    // 🔥 Convertendo o estado de pagamento pro formato ACEITO pelo banco
    const normalizedPayment = mapPaymentStatus(markPaid);

    const { data: appt, error: apptErr } = await supabaseAdmin
      .from("appointments")
      .update({
        status,
        payment_status: normalizedPayment,
      })
      .eq("id", id)
      .select(`
        id,
        client_id,
        professional_id,
        service_id,
        services:service_id ( id, name, price )
      `)
      .single();

    if (apptErr || !appt) {
      throw apptErr || new Error("Agendamento não encontrado");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Erro ao atualizar:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
