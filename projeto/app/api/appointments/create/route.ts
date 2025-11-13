import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

export async function POST(req: Request) {
  try {
    const { appointment, payment } = await req.json();

    // 🧩 Validação básica
    if (
      !appointment?.service_id ||
      !appointment?.professional_id ||
      !appointment?.client_id ||
      !appointment?.start_time
    ) {
      return NextResponse.json(
        { error: "Dados do agendamento incompletos." },
        { status: 400 }
      );
    }

    // 💾 Cria o agendamento
    const { data: appt, error: aErr } = await admin
      .from("appointments")
      .insert([
        {
          service_id: appointment.service_id,
          professional_id: appointment.professional_id,
          client_id: appointment.client_id,
          client_email: appointment.client_email ?? null,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: "confirmado",
          payment_status:
            appointment.payment_status === "pago" ? "pago" : "pendente",
          notes: appointment.notes ?? null,
          created_at: new Date().toISOString(),
        },
      ])
      .select("id, client_id, professional_id, service_id, payment_status")
      .single();

    if (aErr) throw aErr;

    // 💳 Criar pagamento APENAS se o frontend mandou explicitamente "payment"
    if (payment && payment.amount && payment.method) {
      // ⚠️ Verifica se já existe pagamento para este agendamento
      const { data: existing } = await admin
        .from("payments")
        .select("id")
        .eq("appointment_id", appt.id)
        .maybeSingle();

      if (!existing) {
        // 1️⃣ Cria fatura vinculada ao cliente
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

        // 2️⃣ Cria pagamento vinculado
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
