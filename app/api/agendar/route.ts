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

    // 🔎 Verificar se cliente existe
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let client_id = existingClient?.id;

    // 🆕 Criar cliente se não existir
    if (!client_id) {
      const { data: newClient, error: createErr } = await supabase
        .from("clients")
        .insert({ full_name: name, email, phone })
        .select("id")
        .single();

      if (createErr) throw createErr;
      client_id = newClient.id;
    }

    // 🕒 Converter timezone corretamente
    const start_local = toLocalTimestamp(start_time);
    const end_local = toLocalTimestamp(end_time);

    // 🔎 Buscar nome do serviço
    const { data: svc } = await supabase
      .from("services")
      .select("name, description")
      .eq("id", service_id)
      .single();

    const serviceName = svc?.name ?? service ?? "Serviço";
    const serviceDesc = svc?.description ?? "";

    // 🔎 Buscar nome do profissional
    const { data: prof } = await supabase
      .from("professionals")
      .select("name")
      .eq("id", professional_id)
      .single();

    const professionalName = prof?.name ?? "Profissional";

    // 📝 Criar agendamento
    const { error } = await supabase.from("appointments").insert({
      client_id,
      client_email: email,
      professional_id,
      service_id,
      start_time: start_local,
      end_time: end_local,
      status: "confirmed",
      payment_status: "pendente",
      notes: `Agendado via site — ${serviceName}${serviceDesc ? " (" + serviceDesc + ")" : ""}`,
    });

    if (error) throw error;

    // 🔗 LINK do painel do cliente
    const linkAgendamentos = `${process.env.NEXT_PUBLIC_SITE_URL}/minha-agenda/${client_id}`;

    // 📅 Formatadores
    const dataFmt = start_local.split(" ")[0].split("-").reverse().join("/");
    const horaFmt = start_local.split(" ")[1].slice(0, 5);

    // ✉️ Enviar email
    await sendEmailConfirmation(
      email,
      name,
      dataFmt,
      horaFmt,
      serviceName,
      professionalName,
      linkAgendamentos
    );

    // 💬 WhatsApp
    await sendWhatsAppConfirmation(
      phone,
      name,
      dataFmt,
      horaFmt,
      serviceName,
      professionalName,
      linkAgendamentos
    );

    return NextResponse.json({ ok: true, client_id, linkAgendamentos });

  } catch (err: any) {
    console.error("Erro ao confirmar agendamento:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
