import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmailConfirmation } from "@/lib/notify-email";
import { sendWhatsAppConfirmation } from "@/lib/notify-whatsapp";

function toLocalTimestamp(dateString: string) {
  const d = new Date(dateString);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

export async function POST(req: Request) {
  try {
    const {
      name,
      email,
      phone,
      start_time,
      end_time,
      service,
      service_id,
      professional_id,
    } = await req.json();

    if (!name || !email || !phone || !start_time || !end_time || !service_id || !professional_id) {
      throw new Error("Dados faltando para concluir o agendamento.");
    }

    // CLIENTE
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let client_id = existingClient?.id;

    if (!client_id) {
      const { data: newClient, error: createErr } = await supabase
        .from("clients")
        .insert({ full_name: name, email, phone })
        .select("id")
        .single();

      if (createErr) throw createErr;
      client_id = newClient.id;
    }

    // Corrigir timezone corretamente
    const start_local = toLocalTimestamp(start_time);
    const end_local = toLocalTimestamp(end_time);

    // Buscar nome correto do serviço no banco
    const { data: svc } = await supabase
      .from("services")
      .select("name")
      .eq("id", service_id)
      .single();

    const serviceName = svc?.name ?? service ?? "Serviço";

    // SALVAR AGENDAMENTO
    const { error } = await supabase.from("appointments").insert({
      client_id,
      client_email: email,
      professional_id,
      service_id,
      start_time: start_local,
      end_time: end_local,
      status: "confirmed",
      payment_status: "pendente",
      notes: `Agendado via site — ${serviceName}`,
    });

    if (error) throw error;

    await Promise.all([
      sendEmailConfirmation(email, name, start_local.split(" ")[0], start_local.split(" ")[1], serviceName),
      sendWhatsAppConfirmation(phone, name, start_local.split(" ")[0], start_local.split(" ")[1], serviceName),
    ]);

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("Erro ao confirmar agendamento:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
