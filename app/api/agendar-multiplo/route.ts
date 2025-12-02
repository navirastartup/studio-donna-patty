import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmailConfirmation } from "@/lib/notify-email";
import { sendWhatsAppConfirmation } from "@/lib/notify-whatsapp";

/* ============================================================
 * Helpers
 * ============================================================ */
function toLocalTimestamp(dateString: string) {
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:00`;
}

/* ============================================================
 * ROTA POST — AGENDAMENTO MÚLTIPLO
 * ============================================================ */
export async function POST(req: Request) {
  try {
    const { client, items } = await req.json();

    if (!client || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Carrinho vazio." },
        { status: 400 }
      );
    }

    const { name, email, phone } = client;

    /* ============================================================
     * 1 — Buscar ou criar CLIENTE
     * ============================================================ */
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let client_id = existingClient?.id;

    if (!client_id) {
      const { data: newClient, error: newErr } = await supabase
        .from("clients")
        .insert({
          full_name: name,
          email,
          phone,
        })
        .select("id")
        .single();

      if (newErr) throw newErr;
      client_id = newClient.id;
    }

    /* ============================================================
     * 2 — Processar CADA serviço do carrinho individualmente
     * ============================================================ */
    for (const item of items) {
      const start_local = toLocalTimestamp(item.start_time);
      const end_local = toLocalTimestamp(item.end_time);

      /* Dados do serviço */
      const { data: svc } = await supabase
        .from("services")
        .select("name, description")
        .eq("id", item.service_id)
        .single();

      const serviceName = svc?.name ?? item.service_name ?? "Serviço";
      const serviceDesc = svc?.description ?? "";

      /* Nome do profissional */
      const { data: prof } = await supabase
        .from("professionals")
        .select("name")
        .eq("id", item.professional_id)
        .single();

      const professionalName = prof?.name ?? "Profissional";

      /* ============================================================
       * 3 — Criar AGENDAMENTO (dispara realtime automaticamente)
       * ============================================================ */
      const { data: appointment, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          client_id,
          client_email: email,
          professional_id: item.professional_id,
          service_id: item.service_id,
          start_time: start_local,
          end_time: end_local,
          status: "confirmed",
          payment_status: "pendente",
          notes: `Agendado via carrinho — ${serviceName}${
            serviceDesc ? " (" + serviceDesc + ")" : ""
          }`,
        })
        .select("*")
        .single();

      if (apptErr) throw apptErr;

      /* ============================================================
       * 4 — Criar NOTIFICAÇÃO ADMIN (aparece no painel)
       * ============================================================ */
      await supabase.from("notifications").insert({
        type: "appointment_created",
        message: `Novo agendamento via carrinho para ${name}`,
        appointment_id: appointment.id,
      });

      /* ============================================================
       * 5 — FORMATAR dados p/ email & WhatsApp
       * ============================================================ */
      const dataFmt = start_local.split(" ")[0].split("-").reverse().join("/");
      const horaFmt = start_local.split(" ")[1].slice(0, 5);

      const linkAgendamentos =
        `${process.env.NEXT_PUBLIC_SITE_URL}/minha-agenda/${client_id}`;

      /* ============================================================
       * 6 — Enviar EMAIL
       * ============================================================ */
      await sendEmailConfirmation(
        email,
        name,
        dataFmt,
        horaFmt,
        serviceName,
        professionalName,
        linkAgendamentos
      );

      /* ============================================================
       * 7 — Enviar WhatsApp
       * ============================================================ */
      await sendWhatsAppConfirmation(
        phone,
        name,
        dataFmt,
        horaFmt,
        serviceName,
        professionalName,
        linkAgendamentos
      );
    }

    return NextResponse.json({ ok: true, client_id });

  } catch (err: any) {
    console.error("Erro ao confirmar múltiplos agendamentos:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
