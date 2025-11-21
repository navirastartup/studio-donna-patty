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
      markPaid?: boolean;  // true = pago, false = pendente
      method?: string;
      amount?: number;
    } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID e status são obrigatórios" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // 1) Atualiza o agendamento (status + payment_status)
    // ---------------------------------------------------------------
    const updates: any = {
      status,
      payment_status: markPaid ? "paid" : "pending",
    };

    const { data: appt, error: apptErr } = await supabaseAdmin
      .from("appointments")
      .update(updates)
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

    // ---------------------------------------------------------------
    // 2) Descobrir valor correto (se não mandou "amount")
    // ---------------------------------------------------------------
    const serviceObj = Array.isArray(appt.services)
      ? appt.services[0]
      : appt.services;

    const servicePrice = Number(serviceObj?.price || 0);

    const finalAmount =
      typeof amount === "number" && amount > 0
        ? amount
        : servicePrice;

    // ---------------------------------------------------------------
    // 3) Criar registro financeiro (payments)
    //    → Mesmo se NÃO tiver pago, cria PENDENTE
    // ---------------------------------------------------------------
    const now = new Date().toISOString();

    const paymentPayload = {
      appointment_id: appt.id,
      invoice_id: null,
      client_id: appt.client_id,
      professional_id: appt.professional_id,
      service_id: appt.service_id,
      amount: finalAmount,

      // 🔥 LÓGICA IMPORTANTE
      method: markPaid ? method || "Pix" : null,
      status: markPaid ? "approved" : "pending",
      payment_date: markPaid ? now : null,

      created_at: now,
    };

    const { error: payErr } = await supabaseAdmin
      .from("payments")
      .insert([paymentPayload]);

    if (payErr) throw payErr;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Erro ao atualizar status:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
