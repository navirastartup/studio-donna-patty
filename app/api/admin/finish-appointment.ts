import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizePaymentStatus(value: string | undefined | null) {
  if (!value) return "pendente";

  const v = value.toLowerCase();

  if (["paid", "pago", "approved"].includes(v)) return "pago";
  if (["pending", "pendente"].includes(v)) return "pendente";

  return "pendente";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      payment_status,
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
    // 1) NORMALIZA STATUS DO PAGAMENTO
    // -----------------------------------------------------
    const normalized = normalizePaymentStatus(payment_status);

    // -----------------------------------------------------
    // 2) ATUALIZA O AGENDAMENTO
    // -----------------------------------------------------
    const { error: updateErr } = await supabaseAdmin
      .from("appointments")
      .update({
        status,
        payment_status: normalized, // agora SEM ERRO
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // -----------------------------------------------------
    // 3) CRIA LANÇAMENTO FINANCEIRO
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
      status: normalized === "pago" ? "approved" : "pending",
      method: normalized === "pago" ? method || "Pix" : null,
      payment_date: normalized === "pago" ? now : null,
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
