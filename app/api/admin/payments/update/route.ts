import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id, amount, method, status } = await req.json();

    const { error } = await supabaseAdmin
      .from("payments")
      .update({
        amount,
        method,
        status
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
    
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
