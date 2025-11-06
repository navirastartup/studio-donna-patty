import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STATUS_FILE_PATH = path.resolve("./public/whatsapp-status.json");

export async function GET() {
  try {
    if (!fs.existsSync(STATUS_FILE_PATH)) {
      return NextResponse.json({ connected: false });
    }

    const data = JSON.parse(fs.readFileSync(STATUS_FILE_PATH, "utf8"));
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Erro ao ler status do WhatsApp:", error);
    return NextResponse.json({ connected: false });
  }
}
