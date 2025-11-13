import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Caminho correto até o arquivo gerado pelo bot:
const STATUS_FILE = path.resolve("./public/whatsapp-status.json");

export async function GET() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return NextResponse.json({ connected: false, awaitingScan: true });
    }

    const data = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Erro ao ler status do WhatsApp:", error);
    return NextResponse.json({ connected: false });
  }
}
