// ✅ app/api/mercadopago/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;

// ⚙️ Ativa o modo de simulação local
const TEST_MODE = false;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STATUS_MAP: Record<string, string> = {
  pending: "pendente",
  approved: "confirmado",
  cancelled: "cancelado",
  rejected: "cancelado",
  refunded: "reembolsado",
};

const PAYMENT_STATUS_MAP: Record<string, string> = {
  pending: "pendente",
  approved: "pago",
  cancelled: "cancelado",
  rejected: "cancelado",
  refunded: "reembolsado",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🔔 Webhook recebido:", body);

    const paymentId = body?.data?.id;
    if (!paymentId) return NextResponse.json({ ok: true });

    let payment: any;

    // ⚙️ Se o modo de teste estiver ativo, ignora a busca no Mercado Pago
    if (TEST_MODE) {
      payment = body.payment;
      console.log("🧪 [Modo teste ativo] Usando dados simulados do body.");
    } else {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });
      payment = await res.json();
    }

    console.log("💳 Detalhes do pagamento:", payment);

    const preferenceId = payment?.preference_id || null;
    const appointmentId = payment?.metadata?.appointment_id || null;

    const paymentData = {
      id: String(payment.id ?? crypto.randomUUID()),
      invoice_id: payment?.metadata?.invoice_id || null,
      appointment_id: appointmentId || null,
      amount: Number(payment.transaction_amount ?? 0),
      method: payment.payment_method_id || payment.payment_type_id || null,
      payment_date: payment.date_approved ?? new Date().toISOString(),
      raw: JSON.stringify(payment),
      status: PAYMENT_STATUS_MAP[payment.status] || "pendente",
      preference_id: preferenceId,
    };

    const { error: payErr } = await supabaseAdmin
      .from("payments")
      .upsert([paymentData], { onConflict: "id" });

    if (payErr) console.error("❌ Erro ao salvar payment:", payErr);

    const statusOriginal = String(payment.status || "").toLowerCase();
    const novoStatus = STATUS_MAP[statusOriginal] || "pendente";
    const novoPagamento = PAYMENT_STATUS_MAP[statusOriginal] || "pendente";

    const updateData = {
      payment_id: paymentId,
      payment_status: novoPagamento,
      status: novoStatus,
    };

    let updateErr = null;

    if (appointmentId) {
      const result = await supabaseAdmin
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);
      updateErr = result.error;
    } else if (preferenceId) {
      const result = await supabaseAdmin
        .from("appointments")
        .update(updateData)
        .eq("preference_id", preferenceId);
      updateErr = result.error;
    } else {
      console.warn("⚠️ Nenhum appointment_id nem preference_id encontrado.");
    }

    if (updateErr) console.error("❌ Erro ao atualizar agendamento:", updateErr.message);
    else console.log(`✅ Agendamento atualizado → Status: ${novoStatus}, Pagamento: ${novoPagamento}`);

    if (paymentData.invoice_id && novoPagamento === "pago") {
      await supabaseAdmin
        .from("invoices")
        .update({ status: "pago" })
        .eq("id", paymentData.invoice_id);
      console.log(`🧾 Fatura ${paymentData.invoice_id} marcada como "pago"`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Erro no webhook:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
