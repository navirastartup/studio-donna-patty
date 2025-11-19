import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id, newDate } = await req.json();

    if (!id || !newDate)
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ start_time: newDate })
      .eq("id", id);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
