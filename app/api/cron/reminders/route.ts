import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReminderEmail, ReminderType } from "@/lib/notify-reminder";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key);

// Quando lembrar (minutos antes do horário)
const RULES: Record<ReminderType, number> = {
  "24h": 24 * 60,
  "1h": 60,
};

export async function GET() {
  try {
    const now = Date.now();

    const { data: appointments, error } = await admin
      .from("appointments")
      .select(`
        id,
        start_time,
        services:service_id ( name ),
        professionals:professional_id ( name ),
        clients:client_id ( full_name, email )
      `)
      .gte("start_time", new Date().toISOString());

    if (error) throw error;

    for (const appt of appointments || []) {

      // --- ARRUMA ARRAYS DO SUPABASE ---
      const svc = Array.isArray(appt.services) ? appt.services[0] : appt.services;
      const prof = Array.isArray(appt.professionals) ? appt.professionals[0] : appt.professionals;
      const client = Array.isArray(appt.clients) ? appt.clients[0] : appt.clients;

      if (!client?.email) continue;

      const start = new Date(appt.start_time).getTime();
      if (start < now) continue; // não enviar atrasado

      const diff = (start - now) / 60000;
      const date = appt.start_time.slice(0, 10);
      const hour = appt.start_time.slice(11, 16);

      for (const type of Object.keys(RULES) as ReminderType[]) {
        const target = RULES[type];

        if (Math.abs(diff - target) <= 2) {

          // checar duplicado
          const { data: alreadySent } = await admin
            .from("appointment_reminders_sent")
            .select("id")
            .eq("appointment_id", appt.id)
            .eq("type", type)
            .maybeSingle();

          if (alreadySent) continue;

          // --- enviar email ---
          await sendReminderEmail({
            type,
            client,
            service: svc?.name ?? "Serviço",
            professional: prof?.name ?? "Profissional",
            date,
            hour,
          });

          // registrar envio
          await admin
            .from("appointment_reminders_sent")
            .insert({
              appointment_id: appt.id,
              type,
              sent_at: new Date().toISOString(),
            });
        }
      }
    }

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("CRON reminders error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
