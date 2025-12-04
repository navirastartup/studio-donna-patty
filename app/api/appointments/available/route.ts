import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ============================================================================
   UTILITÁRIO: retorna yyyy-mm-dd do HORÁRIO LOCAL (sem UTC!)
============================================================================ */
function todayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* Converte date + "HH:mm" para Date local */
function makeLocal(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export async function POST(req: Request) {
  try {
    const { date, professional_id, service_id } = await req.json();

    if (!date || !service_id) {
      return NextResponse.json(
        { error: "Data e serviço obrigatórios." },
        { status: 400 }
      );
    }

    /* ============================================================================
       (1) VALIDAR SE O DIA É PASSADO — MAS AGORA USANDO DATA LOCAL SEM UTC
    ============================================================================ */
    const today = todayLocal();
    if (date < today) {
      return NextResponse.json({ available: [], closed: true });
    }

    /* ============================================================================
       (2) BUSCAR HORÁRIOS DA AGENDA
    ============================================================================ */
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
    const weekdayName = weekdays[new Date(Y, M - 1, D).getDay()];

    const { data: schedule } = await supabase
      .from("schedules")
      .select("*")
      .eq("day_of_week", weekdayName)
      .single();

    if (!schedule || schedule.start_time === "00:00:00") {
      return NextResponse.json({ available: [], closed: true });
    }

    const open = schedule.start_time;
    const close = schedule.end_time;
    const breakStart = schedule.break_start_time;
    const breakEnd = schedule.break_end_time;

    /* ============================================================================
       (3) PEGAR DURAÇÃO DO SERVIÇO
    ============================================================================ */
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", service_id)
      .single();

    const duration = service?.duration_minutes ?? 60;

    /* ============================================================================
       (4) BUSCAR AGENDAMENTOS EXISTENTES
    ============================================================================ */
    let query = supabase
      .from("appointments")
      .select("start_time, end_time")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`);

    if (professional_id) query = query.eq("professional_id", professional_id);

    const { data: booked } = await query;

    const events = (booked || []).map((e) => ({
      start: new Date(e.start_time).getTime(),
      end: new Date(e.end_time).getTime(),
    }));

    /* ============================================================================
       (5) GERAR LISTA DE HORÁRIOS BRUTOS
    ============================================================================ */
    const startHour = parseInt(open.split(":")[0]);
    const endHour = parseInt(close.split(":")[0]);

    const slots: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      const hh = String(h).padStart(2, "0");
      slots.push(`${hh}:00`);

      // Caso específico do seu salão
      if (h === 13 && breakEnd === "13:30:00") slots.push("13:30");
    }

    /* ============================================================================
       (6) REMOVER HORÁRIOS NA PAUSA
    ============================================================================ */
    let filtered = slots.filter((slot) => {
      if (!breakStart || !breakEnd) return true;

      const t = makeLocal(date, slot).getTime();
      const p1 = makeLocal(date, breakStart).getTime();
      const p2 = makeLocal(date, breakEnd).getTime();

      return !(t >= p1 && t < p2);
    });

    /* ============================================================================
       (7) BLOQUEAR HORÁRIOS PASSADOS (AGORA CORRETO!)
    ============================================================================ */
    const isToday = date === todayLocal();

    if (isToday) {
      const now = new Date(); // horário real BR
      const nowTs = now.getTime();

      filtered = filtered.filter((slot) => {
        const slotTs = makeLocal(date, slot).getTime();
        return slotTs > nowTs;
      });
    }

    /* ============================================================================
       (8) REMOVER HORÁRIOS QUE DÃO CONFLITO COM AGENDAMENTOS
    ============================================================================ */
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
