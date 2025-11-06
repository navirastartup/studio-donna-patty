import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚡ usa service role
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updates = body.updates; // array [{ key, value }]

    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from("settings")
        .upsert(update, { onConflict: "key" });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao salvar configurações:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
