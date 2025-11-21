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

    // Atualiza o agendamento
    const updates: any = { status };

    if (markPaid) {
      updates.payment_status = "paid";
    }

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

    // Se não precisa lançar no financeiro, finaliza aqui.
    if (!markPaid) {
      return NextResponse.json({ ok: true });
    }

// Descobre valor correto
const serviceObj = Array.isArray(appt.services)
  ? appt.services[0]
  : appt.services;

const servicePrice = Number(serviceObj?.price || 0);


    const finalAmount =
      typeof amount === "number" && amount > 0
        ? amount
        : Number(servicePrice || 0);

    // Cria registro no financeiro
    const now = new Date().toISOString();

    const paymentPayload = {
      appointment_id: appt.id,
      invoice_id: null,
      client_id: appt.client_id,
      professional_id: appt.professional_id,
      service_id: appt.service_id,
      amount: finalAmount,
      method: method || "Pix",
      status: "approved",
      payment_date: now,
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
