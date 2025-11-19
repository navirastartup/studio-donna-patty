import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json(
    { ok: false, message: "WhatsApp bot desativado no momento." },
    { status: 200 }
  );
}
