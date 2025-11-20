import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function makeLocalDate(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm); // sem UTC
}

export async function POST(req: Request) {
  try {
    const { date, professional_id, service_id } = await req.json();

    if (!date || !service_id) {
      return NextResponse.json(
        { error: "Data e serviço são obrigatórios" },
        { status: 400 }
      );
    }

    // Dia da semana sem bug de timezone
    const [year, month, dayNum] = date.split("-").map(Number);
    const day = new Date(year, month - 1, dayNum).getDay();

    // 1 — Horário do salão
    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", day)
      .single();

    if (!schedule) {
      return NextResponse.json({ available: [] });
    }

    const open = schedule.start_time;  
    const close = schedule.end_time;

    // 2 — Duração do serviço
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", service_id)
      .single();

    if (!service?.duration_minutes) {
      return NextResponse.json({ available: [] });
    }

    const duration = service.duration_minutes;

// 3 — Gerar horários usando horário local REAL
const slots: string[] = [];
let current = makeLocalDate(date, open);
const limit = makeLocalDate(date, close);

while (current < limit) {
  const finish = new Date(current.getTime() + duration * 60000);

  if (finish <= limit) {
    // **CORREÇÃO — sem UTC**
    const hh = String(current.getHours()).padStart(2, "0");
    const mm = String(current.getMinutes()).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }

  current = new Date(current.getTime() + 30 * 60000);
}
    // 4 — Buscar agendamentos existentes
    let query = supabase
      .from("appointments")
      .select("start_time, end_time, professional_id")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`);

    if (professional_id) query = query.eq("professional_id", professional_id);

    const { data: booked } = await query;

    const blocked =
      booked?.map((b) => ({
        start: new Date(b.start_time).getTime(),
        end: new Date(b.end_time).getTime(),
      })) || [];

    // 5 — Filtrar horários ocupados
    const available = slots.filter((slot) => {
      const start = new Date(slot).getTime();
      const end = start + duration * 60000;

      // intervalo livre = NÃO colide com nenhum ocupado
      return !blocked.some((b) => !(end <= b.start || start >= b.end));
    });

    return NextResponse.json({ available });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
