// app/api/clients/[id]/delete/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const clientId = params.id;

  try {
    const { error } = await supabaseServer
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (error) {
      console.error("ERRO AO DELETAR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}
