import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id)
      return NextResponse.json({ error: "ID não enviado" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("appointments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao deletar:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro interno:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
