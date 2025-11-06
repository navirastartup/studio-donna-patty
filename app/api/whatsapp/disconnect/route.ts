import { NextResponse } from "next/server";
import fs from "fs";

export async function POST() {
  try {
    const statusPath = "./public/whatsapp-status.json";
    const sessionPath = "./.wwebjs_auth"; // pasta padrão do whatsapp-web.js

    if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
