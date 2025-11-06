import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ GET → listar
export async function GET() {
  try {
    const { data, error } = await supabase.from("professionals").select("*");
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ✅ POST → criar
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, error } = await supabase.from("professionals").insert([body]);
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ✅ PUT → atualizar
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    const { data, error } = await supabase.from("professionals").update(updates).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ✅ DELETE → deletar
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    const { error } = await supabase.from("professionals").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
