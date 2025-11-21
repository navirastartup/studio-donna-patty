import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, status, payment_status, value, client_id, professional_id, service_name } = body;

    // 1) Atualiza o agendamento
    await supabase
      .from("appointments")
      .update({
        status,
        payment_status,
      })
      .eq("id", id);

    // 2) Lança no financeiro
    await supabase.from("finance").insert({
      type: "income",
      description: `Serviço: ${service_name}`,
      value,
      appointment_id: id,
      client_id,
      professional_id,
      created_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
