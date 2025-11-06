import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

export async function POST(req: Request) {
  try {
    const { appointment, payment } = await req.json();

    if (!appointment?.service_id || !appointment?.professional_id || !appointment?.client_id || !appointment?.start_time) {
      return NextResponse.json({ error: "Dados do agendamento incompletos." }, { status: 400 });
    }

    const { data: appt, error: aErr } = await admin
      .from("appointments")
      .insert([{
        service_id: appointment.service_id,
        professional_id: appointment.professional_id,
        client_id: appointment.client_id,
        client_email: appointment.client_email ?? null,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: appointment.status ?? "confirmed",
        payment_status: appointment.payment_status ?? "pendente",
        notes: appointment.notes ?? null,
        created_at: new Date().toISOString(),
      }])
      .select("id")
      .single();

    if (aErr) throw aErr;

    if (payment && appointment.payment_status === "pago") {
      const payData = {
        appointment_id: appt.id,
        amount: Number(payment.amount ?? 0),
        method: String(payment.method ?? "Outro"),
        payment_date: new Date().toISOString(),
        status: "approved",
      };
      const { error: pErr } = await admin.from("payments").insert([payData]);
      if (pErr) throw pErr;
    }

    return NextResponse.json({ ok: true, id: appt.id });
  } catch (err: any) {
    console.error("create appointment error:", err);
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 });
  }
}
