import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    // 1) Atualiza o agendamento (STATUS + payment_status)
    const paymentStatusAppt = markPaid ? "pago" : "pendente";

    const { data: appt, error: apptErr } = await supabaseAdmin
      .from("appointments")
      .update({
        status,
        payment_status: paymentStatusAppt,
      })
      .eq("id", id)
      .select(
        `
        id,
        client_id,
        professional_id,
        service_id,
        services:service_id ( id, name, price )
      `
      )
      .single();

    if (apptErr || !appt) {
      throw apptErr || new Error("Agendamento não encontrado");
    }

    // 2) Descobrir valor (amount escolhido no modal OU preço do serviço)
    const service = Array.isArray(appt.services)
      ? appt.services[0]
      : appt.services;

    const price = amount ?? service?.price ?? 0;

    // 3) Definir status do pagamento (na tabela payments)
    const finalStatus = markPaid ? "approved" : "pending";
    const finalPaymentDate = markPaid ? new Date().toISOString() : null;

    // 4) Verifica se já existe payment para esse appointment
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("appointment_id", id)
      .maybeSingle();

    if (existErr) throw existErr;

    // 5) Se existir → UPDATE
    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from("payments")
        .update({
          amount: price,
          method: method || "Outro",
          status: finalStatus,
          payment_date: finalPaymentDate,
          updated_at: new Date().toISOString(),
        })
        .eq("appointment_id", id);

      if (updateErr) throw updateErr;
    } else {
      // 6) Se não existir → INSERT
      const { error: insertErr } = await supabaseAdmin
        .from("payments")
        .insert({
          appointment_id: id,
          client_id: appt.client_id,
          professional_id: appt.professional_id,
          service_id: appt.service_id,
          amount: price,
          method: method || "Outro",
          status: finalStatus,
          payment_date: finalPaymentDate,
          created_at: new Date().toISOString(),
        });

      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("🔥 ERRO update-status:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
