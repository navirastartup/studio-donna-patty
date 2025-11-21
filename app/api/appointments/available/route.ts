import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Cria Date local (sem UTC)
function makeLocal(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export async function POST(req: Request) {
  try {
    const { date, professional_id, service_id } = await req.json();

    if (!date || !service_id) {
      return NextResponse.json(
        { error: "Data e serviço são obrigatórios." },
        { status: 400 }
      );
    }

    // Dia da semana baseado na data (sem timezone)
    const [Y, M, D] = date.split("-").map(Number);
    const weekDay = new Date(Y, M - 1, D).getDay();

    // 1 — Buscar horário do salão
    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", weekDay)
      .single();

    if (!schedule) return NextResponse.json({ available: [] });

    const open = schedule.start_time;       // "07:00"
    const close = schedule.end_time;        // "18:00"
    const breakStart = schedule.break_start_time; // "13:00"
    const breakEnd = schedule.break_end_time;     // "13:30"

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

    // 3 — Gerar todos os slots possíveis
    const slots: string[] = [];

    let current = makeLocal(date, open);
    const limit = makeLocal(date, close);

    while (current < limit) {
      const end = new Date(current.getTime() + duration * 60000);

      // slot só entra se terminar ANTES ou IGUAL ao limite
      if (end <= limit) {
        const hh = String(current.getHours()).padStart(2, "0");
        const mm = String(current.getMinutes()).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }

      current = new Date(current.getTime() + 30 * 60000);
    }

    // 4 — Remover horários que caem dentro da pausa
    const filteredSlots = slots.filter((slot) => {
      if (!breakStart || !breakEnd) return true;

      const slotTime = makeLocal(date, slot).getTime();
      const pauseStart = makeLocal(date, breakStart).getTime();
      const pauseEnd = makeLocal(date, breakEnd).getTime();

      return !(slotTime >= pauseStart && slotTime < pauseEnd);
    });

    // 5 — Buscar agendamentos existentes
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

    // 6 — Filtrar slots que colidem
    const available = filteredSlots.filter((slot) => {
      const start = makeLocal(date, slot).getTime();
      const end = start + duration * 60000;

      return !blocked.some((b) => !(end <= b.start || start >= b.end));
    });

    // 7 — Se 18:00 não coube, mas algum horário após isso couber → adicionar automaticamente
    const lastPossibleStart = new Date(limit.getTime() - duration * 60000);
    const lastHH = String(lastPossibleStart.getHours()).padStart(2, "0");
    const lastMM = String(lastPossibleStart.getMinutes()).padStart(2, "0");
    const lastSlot = `${lastHH}:${lastMM}`;

    if (
      !available.includes(lastSlot) &&
      !filteredSlots.includes(lastSlot)
    ) {
      // caso o lastSlot tenha sido removido pela pausa ou outro fator, não adiciona
    } else if (!available.includes(lastSlot)) {
      // verificar colisão antes de adicionar
      const s = makeLocal(date, lastSlot).getTime();
      const e = s + duration * 60000;

      const collides = blocked.some((b) => !(e <= b.start || s >= b.end));

      if (!collides) available.push(lastSlot);
    }

    return NextResponse.json({
      available: available.sort(),
    });
  } catch (e: any) {
    console.error("ERRO:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
