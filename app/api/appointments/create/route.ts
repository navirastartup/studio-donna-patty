import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

/** Corrige timezone — cria data local sem UTC */
function makeLocal(date: string, time: string) {
  return `${date}T${time}:00`;
}


export async function POST(req: Request) {
  try {
    const { appointment, payment } = await req.json();

    if (
      !appointment?.service_id ||
      !appointment?.professional_id ||
      !appointment?.client_id ||
      !appointment?.date ||
      !appointment?.time
    ) {
      return NextResponse.json(
        { error: "Dados do agendamento incompletos." },
        { status: 400 }
      );
    }

    const { date, time } = appointment;

    // -----------------------------------------------
    // 1) PEGAR DURAÇÃO DO SERVIÇO
    // -----------------------------------------------
    const { data: service } = await admin
      .from("services")
      .select("duration_minutes")
      .eq("id", appointment.service_id)
      .single();

    if (!service) {
      return NextResponse.json(
        { error: "Serviço não encontrado." },
        { status: 400 }
      );
    }

    const duration = service.duration_minutes ?? 60;

    // -----------------------------------------------
    // 2) CORRIGIR start e end (SEM UTC BUG)
    // -----------------------------------------------
 const start_time = makeLocal(date, time);

// calcular horário final sem UTC
const [hh, mm] = time.split(":").map(Number);

const endDate = new Date(`${date}T${time}:00`);
endDate.setMinutes(endDate.getMinutes() + duration);

const endH = String(endDate.getHours()).padStart(2, "0");
const endM = String(endDate.getMinutes()).padStart(2, "0");

const end_time = `${date}T${endH}:${endM}:00`;

    // -----------------------------------------------
    // 3) CRIAR AGENDAMENTO MANUAL (is_manual = true)
    // -----------------------------------------------

    console.log("📌 RECEBIDO DO FRONT:", appointment);
    console.log("➡️ start_time final:", start_time);
    console.log("➡️ end_time final:", end_time);


    const { data: appt, error: aErr } = await admin
      .from("appointments")
      .insert([
        {
          service_id: appointment.service_id,
          professional_id: appointment.professional_id,
          client_id: appointment.client_id,
          client_email: appointment.client_email ?? null,
          start_time,
          end_time,
          status: "confirmed",
          payment_status:
            appointment.payment_status === "pago" ? "pago" : "pendente",
          notes: appointment.notes ?? null,

          /** MUITO IMPORTANTE — AGENDAMENTO MANUAL */
          is_manual: true,

          created_at: new Date().toISOString(),
        },
      ])
      .select("id, client_id, professional_id, service_id, payment_status")
      .single();

    if (aErr) throw aErr;

    // -----------------------------------------------
    // 4) SE O AGENDAMENTO FOI PAGO MANUALMENTE
    // -----------------------------------------------
    if (payment && payment.amount && payment.method) {
      // criar invoice
      const { data: invoice, error: invErr } = await admin
        .from("invoices")
        .insert([
          {
            client_id: appointment.client_id,
            total: Number(payment.amount ?? 0),
            created_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (invErr) throw invErr;

      // criar pagamento vinculado
      const { error: pErr } = await admin.from("payments").insert([
        {
          appointment_id: appt.id,
          invoice_id: invoice.id,
          client_id: appointment.client_id,
          professional_id: appointment.professional_id,
          service_id: appointment.service_id,
          amount: Number(payment.amount ?? 0),
          method: String(payment.method ?? "Outro"),
          status: "approved",
          payment_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);

      if (pErr) throw pErr;
    }

    return NextResponse.json({ ok: true, id: appt.id });

  } catch (err: any) {
    console.error("❌ create appointment error:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao criar agendamento." },
      { status: 500 }
    );
  }
}
