import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function makeLocal(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export async function POST(req: Request) {
  try {
    const { date, professional_id, service_id } = await req.json();

    if (!date || !service_id) {
      return NextResponse.json({ error: "Data e serviço obrigatórios." }, { status: 400 });
    }

    const weekdays = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    const [Y, M, D] = date.split("-").map(Number);
    const weekDay = new Date(Y, M - 1, D).getDay();
    const weekdayName = weekdays[weekDay];

    // 1. Buscar horários cadastrados
    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", weekdayName)
      .single();

// DIA FECHADO
if (!schedule || schedule.start_time === "00:00:00" || schedule.end_time === "00:00:00") {
  return NextResponse.json({ available: [], closed: true });
    }

    const open = schedule.start_time;
    const close = schedule.end_time;
    const breakStart = schedule.break_start_time;
    const breakEnd = schedule.break_end_time;

    // 2. Buscar duração
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", service_id)
      .single();

    const duration = service?.duration_minutes;
    if (!duration) return NextResponse.json({ available: [] });

    // 3. Buscar agendamentos do dia
    let query = supabase
      .from("appointments")
      .select("start_time, end_time")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`);

    if (professional_id) query = query.eq("professional_id", professional_id);

    const { data: booked } = await query;

    const events = (booked || []).map((b) => ({
      start: new Date(b.start_time).getTime(),
      end: new Date(b.end_time).getTime(),
    }));

    // 4. GERAR HORÁRIOS EXATOS DO BANCO (sem intervalos artificiais)
    const startHour = parseInt(open.split(":")[0]);
    const endHour = parseInt(close.split(":")[0]);

    const slots: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      const hh = String(h).padStart(2, "0");
      const full = `${hh}:00`;
      slots.push(full);

      // Adicionar 13:30 SE NÃO ESTIVER NO BREAK
      if (h === 13 && breakEnd === "13:30:00") {
        slots.push("13:30");
      }
    }

    // Remover pausas
    const filtered = slots.filter((slot) => {
      if (!breakStart || !breakEnd) return true;

      const t = makeLocal(date, slot).getTime();
      const pauseStart = makeLocal(date, breakStart).getTime();
      const pauseEnd = makeLocal(date, breakEnd).getTime();

      return !(t >= pauseStart && t < pauseEnd);
    });

    // 5. Verificar conflitos com duração
    const available = filtered.filter((slot) => {
      const start = makeLocal(date, slot).getTime();
      const end = start + duration * 60000;

      return !events.some((e) => start < e.end && end > e.start);
    });

    return NextResponse.json({ available, closed: false });

  } catch (e: any) {
    console.log("ERRO DISPONIBILIDADE:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
