import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmailConfirmation } from "@/lib/notify-email";
import { sendWhatsAppConfirmation } from "@/lib/notify-whatsapp";

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

    // --- CLIENTE ---
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

    // --- SALVAR SEM UTC ---
    const formatLocal = (d: string) => d.replace("Z", "");

    const start_local = formatLocal(start_time);
    const end_local = formatLocal(end_time);

    const { error } = await supabase.from("appointments").insert({
      client_id,
      client_email: email,
      professional_id,
      service_id,
      start_time: start_local,
      end_time: end_local,
      status: "confirmed",
      payment_status: "pendente",
      notes: `Agendado via site — ${service}`,
    });

    if (error) throw error;

    await Promise.all([
      sendEmailConfirmation(email, name, start_local.split("T")[0], start_local.split("T")[1], service),
      sendWhatsAppConfirmation(phone, name, start_local.split("T")[0], start_local.split("T")[1], service),
    ]);

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("Erro ao confirmar agendamento:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
