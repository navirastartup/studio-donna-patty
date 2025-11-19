import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { date, professional_id, service_id } = await req.json();

    if (!date || !service_id) {
      return NextResponse.json({ error: "Data e serviço são obrigatórios" }, { status: 400 });
    }

    const day = new Date(date).getDay();

    // 1 — Horário de funcionamento do salão
    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", day)
      .single();

    if (!schedule || !schedule.start_time || !schedule.end_time) {
      return NextResponse.json({ available: [] });
    }

    const open = schedule.start_time;  // "08:00"
    const close = schedule.end_time;   // "18:00"

    // 2 — Buscar duração do serviço
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", service_id)
      .single();

    if (!service?.duration_minutes) {
      return NextResponse.json({ available: [] });
    }

    const duration = service.duration_minutes;

    // 3 — Gerar possíveis horários (intervalo de 30 minutos)
    const slots: string[] = [];
    let current = new Date(`${date}T${open}`);
    const limit = new Date(`${date}T${close}`);

    while (current < limit) {
      const finish = new Date(current.getTime() + duration * 60000);
      if (finish <= limit) slots.push(current.toISOString());
      current = new Date(current.getTime() + 30 * 60000);
    }

    // 4 — Buscar horários ocupados do dia
    let query = supabase
      .from("appointments")
      .select("start_time, end_time, professional_id")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`);

    if (professional_id) query = query.eq("professional_id", professional_id);

    const { data: booked } = await query;

    // 5 — Converter reservas em intervalos bloqueados
    const blocked: { start: number; end: number }[] =
      booked?.map((b) => ({
        start: new Date(b.start_time).getTime(),
        end: new Date(b.end_time).getTime(),
      })) || [];

    // 6 — Filtrar horários disponíveis
    const available = slots.filter((slot) => {
      const start = new Date(slot).getTime();
      const end = start + duration * 60000;

      return !blocked.some((b) => !(end <= b.start || start >= b.end));
    });

    return NextResponse.json({ available });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
