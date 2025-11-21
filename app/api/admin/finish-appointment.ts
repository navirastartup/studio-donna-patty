import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      payment_status,    // "paid" | "pending"
      value,
      client_id,
      professional_id,
      service_name,
      service_id,
      method,
    } = body;

    if (!id || !status) {
      return Response.json(
        { error: "ID e status são obrigatórios" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // NORMALIZA STATUS DO PAGAMENTO
    // -----------------------------------------------------
    const normalizedPayment =
      payment_status === "paid" ||
      payment_status === "approved" ||
      payment_status === "pago"
        ? "paid"
        : "pending";

    // -----------------------------------------------------
    // 1) ATUALIZA O AGENDAMENTO
    // -----------------------------------------------------
    const { error: updateErr } = await supabaseAdmin
      .from("appointments")
      .update({
        status,
        payment_status: normalizedPayment,
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // -----------------------------------------------------
    // 2) CRIA LANÇAMENTO FINANCEIRO
    // -----------------------------------------------------
    const now = new Date().toISOString();

    const financePayload = {
      appointment_id: id,
      client_id,
      professional_id,
      service_id,
      type: "income",
      description: `Serviço: ${service_name}`,
      value,
      status: normalizedPayment === "paid" ? "approved" : "pending",
      method: normalizedPayment === "paid" ? method || "Pix" : null,
      payment_date: normalizedPayment === "paid" ? now : null,
      created_at: now,
    };

    const { error: financeErr } = await supabaseAdmin
      .from("finance")
      .insert(financePayload);

    if (financeErr) throw financeErr;

    return Response.json({ ok: true });

  } catch (err: any) {
    console.error("Erro ao finalizar agendamento:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
