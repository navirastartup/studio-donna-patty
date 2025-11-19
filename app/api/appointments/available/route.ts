import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { date, professional_id } = await req.json();

    if (!date) {
      return NextResponse.json({ error: "Data não enviada" }, { status: 400 });
    }

    // 1 — pegar horário de abertura/fechamento do salão
    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", new Date(date).getDay())
      .single();

    if (!schedule || !schedule.start_time || !schedule.end_time) {
      return NextResponse.json({ slots: [] });
    }

    // gerar todos horários do expediente
    const start = schedule.start_time; // "08:00"
    const end = schedule.end_time;     // "18:00"

    const slots: string[] = [];
    let current = new Date(`${date}T${start}`);
    const limit = new Date(`${date}T${end}`);

    while (current < limit) {
      slots.push(current.toISOString());
      current = new Date(current.getTime() + 60 * 60 * 1000); // intervalos de 1h
    }

    // 2 — buscar horários já ocupados
    let query = supabase
      .from("appointments")
      .select("start_time")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`);

    if (professional_id) query = query.eq("professional_id", professional_id);

    const { data: booked } = await query;

    const bookedSlots = booked?.map((b) => b.start_time) || [];

    // 3 — filtrar horários livres
    const available = slots.filter(
      (slot) => !bookedSlots.includes(slot)
    );

    return NextResponse.json({ available });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
