import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmailConfirmation } from "@/lib/notify-email";
import { sendWhatsAppConfirmation } from "@/lib/notify-whatsapp";

// --- Função: gerar horário sem UTC ---
function makeLocalDate(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm); // sem UTC
}

export async function POST(req: Request) {
  try {
    const {
      name,
      email,
      phone,
      date,
      time,
      service,
      professional_id,
      service_id,
    } = await req.json();

    if (!name || !email || !phone || !date || !time || !service || !professional_id || !service_id) {
      throw new Error("Dados faltando para concluir o agendamento.");
    }

    // ----- 1. CLIENTE -----
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

    // ----- 2. DATA NORMALIZADA -----
    let normalizedDate = date;

    if (date.includes("/")) {
      const [day, month, year] = date.split("/");
      normalizedDate = `${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
    }

    // ----- 3. HORÁRIO LOCAL SEM UTC -----
    const startLocal = makeLocalDate(normalizedDate, time);

    const duration = 60; // pode substituir depois
    const endLocal = new Date(startLocal.getTime() + duration * 60000);

    const start_iso = startLocal.toISOString().slice(0, 19); // REMOVE O Z
    const end_iso = endLocal.toISOString().slice(0, 19); // REMOVE O Z

    // ----- 4. SALVAR NO BANCO -----
    const { error } = await supabase.from("appointments").insert({
      client_id,
      client_email: email,
      professional_id,
      service_id,
      start_time: start_iso, // agora SEM UTC
      end_time: end_iso,     // agora SEM UTC
      status: "confirmed",
      payment_status: "pendente",
      notes: `Agendado via site — ${service}`,
    });

    if (error) throw error;

    // ----- 5. NOTIFICAÇÕES -----
    await Promise.all([
      sendEmailConfirmation(email, name, date, time, service),
      sendWhatsAppConfirmation(phone, name, date, time, service),
    ]);

    return NextResponse.json({ ok: true });
    
  } catch (err: any) {
    console.error("Erro ao confirmar agendamento:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
