import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ só no server
);

export async function POST(req: Request) {
  try {
    const { schedules } = await req.json();

    for (const s of schedules) {
      if (s.id) {
        const { error } = await supabaseAdmin
          .from("schedules")
          .update({
            start_time: s.start_time,
            end_time: s.end_time,
            break_start_time: s.break_start_time ?? null,
            break_end_time: s.break_end_time ?? null,
          })
          .eq("id", s.id);

        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("schedules").insert({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          break_start_time: s.break_start_time ?? null,
          break_end_time: s.break_end_time ?? null,
        });

        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao salvar horários:", err);
    return NextResponse.json(
      { error: err.message || "Falha ao salvar horários" },
      { status: 500 }
    );
  }
}
