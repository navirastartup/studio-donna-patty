import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmailConfirmation } from "@/lib/notify-email";
import { sendWhatsAppConfirmation } from "@/lib/notify-whatsapp";

export async function POST(req: Request) {
  try {
    const { name, email, phone, date, time, service, professional_id } = await req.json();

if (!professional_id) {
  throw new Error("Profissional não informado no agendamento.");
}

        // ✅ validações
        if (!name || !email || !phone || !date || !time || !service || !professional_id) {
            throw new Error("Dados faltando para concluir o agendamento.");
          }

    // 🔹 1. Garantir cliente existente ou criar novo
    let client_id: string | null = null;

    const { data: existingClient, error: findErr } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (findErr) throw findErr;

    if (existingClient?.id) {
      client_id = existingClient.id;
    } else {
      const { data: newClient, error: createErr } = await supabase
        .from("clients")
        .insert({
          full_name: name,
          email,
          phone,
        })
        .select("id")
        .single();

      if (createErr) throw createErr;
      client_id = newClient.id;
    }

// 🔹 2. Montar horário
console.log("📅 Dados recebidos do front:", { date, time });

let normalizedDate = date;

// Aceita "5/11/2025" → "2025-11-05" com zeros garantidos
if (typeof date === "string") {
  if (date.includes("/")) {
    const [day, month, year] = date.split("/");
    const dayPadded = day.padStart(2, "0");
    const monthPadded = month.padStart(2, "0");
    normalizedDate = `${year}-${monthPadded}-${dayPadded}`;
  } else if (date.includes("-")) {
    // se já vier ISO-like
    normalizedDate = date;
  } else {
    throw new Error(`Formato de data inválido: ${date}`);
  }
} else {
  throw new Error(`Tipo inesperado de data: ${typeof date}`);
}

const start_time = new Date(`${normalizedDate}T${time}:00`);
const end_time = new Date(start_time.getTime() + 60 * 60 * 1000);

if (isNaN(start_time.getTime())) {
  console.error("❌ Data/hora inválida detectada:", {
    rawDate: date,
    normalizedDate,
    time,
  });
  throw new Error("Data ou hora inválida recebida no agendamento.");
}

console.log("✅ Horário validado:", { start_time, end_time });


    // 🔹 3. Inserir agendamento compatível com seu schema
    const { error } = await supabase.from("appointments").insert({
        client_id,
        client_email: email,
        professional_id,
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        service_id: null,
        status: "confirmed",
        payment_status: "pendente", // ✅ ATUALIZADO
        notes: `Agendado via site — ${service}`,
      });      
    if (error) throw error;

    // 🔹 4. Enviar notificações (em paralelo)
    await Promise.all([
      sendEmailConfirmation(email, name, date, time, service),
      sendWhatsAppConfirmation(phone, name, date, time, service),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Agendamento confirmado e notificações enviadas.",
    });
  } catch (err: any) {
    console.error("Erro ao confirmar agendamento:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
