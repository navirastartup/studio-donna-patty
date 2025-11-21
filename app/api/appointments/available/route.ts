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

    const [Y, M, D] = date.split("-").map(Number);
    const weekDay = new Date(Y, M - 1, D).getDay();

    // 1. Horário do salão
    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", weekDay)
      .single();

    if (!schedule) return NextResponse.json({ available: [] });

    const open = schedule.start_time;
    const close = schedule.end_time;
    const breakStart = schedule.break_start_time;
    const breakEnd = schedule.break_end_time;

    // 2. Duração do serviço
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", service_id)
      .single();

    if (!service?.duration_minutes)
      return NextResponse.json({ available: [] });

    const duration = service.duration_minutes;

    // 3. Gerar slots
    const slots: string[] = [];
    let current = makeLocal(date, open);
    const limit = makeLocal(date, close);

    while (current < limit) {
      const end = new Date(current.getTime() + duration * 60000);

      if (end <= limit) {
        const hh = String(current.getHours()).padStart(2, "0");
        const mm = String(current.getMinutes()).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }

      current = new Date(current.getTime() + 30 * 60000);
    }

    // 4. Remover horários dentro da pausa
    const filteredSlots = slots.filter((slot) => {
      if (!breakStart || !breakEnd) return true;

      const slotTime = makeLocal(date, slot).getTime();
      const pauseStart = makeLocal(date, breakStart).getTime();
      const pauseEnd = makeLocal(date, breakEnd).getTime();

      return !(slotTime >= pauseStart && slotTime < pauseEnd);
    });

    // 5. Buscar agendamentos existentes
    let query = supabase
      .from("appointments")
      .select("start_time, end_time")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`);

    if (professional_id) query = query.eq("professional_id", professional_id);

    const { data: booked } = await query;

    const events =
      booked?.map((b) => ({
        start: new Date(b.start_time).getTime(),
        end: new Date(b.end_time).getTime(),
      })) || [];

    const BREAK = 10 * 60000; // 10 minutos

    // 🔥 SE NÃO TEM NENHUM AGENDAMENTO → libera todos os slots filtrados
    if (events.length === 0) {
      return NextResponse.json({
        available: filteredSlots,
      });
    }

    // 6. Filtrar colisões (com intervalo obrigatório)
    const available = filteredSlots.filter((slot) => {
      const start = makeLocal(date, slot).getTime();
      const end = start + duration * 60000;

      return !events.some((b) => {
        return !(
          end + BREAK <= b.start ||
          start >= b.end + BREAK
        );
      });
    });

    // 7. Limitar para não oferecer horários MUITO tarde
    const final = available.filter((slot) => {
      const [h] = slot.split(":").map(Number);
      return h <= 20; // limite máximo 20:00
    });

    return NextResponse.json({ available: final });
  } catch (e: any) {
    console.error("ERRO:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
