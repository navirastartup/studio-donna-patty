import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// cria timestamp local sem UTC
function makeLocal(date: string, time: string) {
  return `${date}T${time}:00`;
}

export async function POST(req: Request) {
  try {
    const { id, date, time } = await req.json();

    if (!id || !date || !time) {
      return NextResponse.json(
        { error: "Faltam dados para reagendar." },
        { status: 400 }
      );
    }

    // Buscar duração do serviço
    const { data: ap, error: apErr } = await admin
      .from("appointments")
      .select("service:services(duration_minutes)")
      .eq("id", id)
      .single();

    if (apErr) throw apErr;

    const duration = ap?.service?.[0]?.duration_minutes ?? 60;

    // novo horário
    const start_time = makeLocal(date, time);

    const [hh, mm] = time.split(":").map(Number);
    const endDate = new Date(`${date}T${time}:00`);
    endDate.setMinutes(endDate.getMinutes() + duration);

    const endH = String(endDate.getHours()).padStart(2, "0");
    const endM = String(endDate.getMinutes()).padStart(2, "0");

    const end_time = `${date}T${endH}:${endM}:00`;

    // Atualizar agendamento
    const { error: updErr } = await admin
      .from("appointments")
      .update({
        start_time,
        end_time
      })
      .eq("id", id);

    if (updErr) throw updErr;

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("❌ ERRO AO REAGENDAR:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno." },
      { status: 500 }
    );
  }
}
