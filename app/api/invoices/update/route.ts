// app/api/invoices/update/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id, data } = await req.json();

    if (!id || !data) {
      return NextResponse.json(
        { error: "Missing id or data" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("invoices")
      .update(data)
      .eq("id", id);

    if (error) {
      console.error("Erro ao atualizar fatura:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro interno:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
