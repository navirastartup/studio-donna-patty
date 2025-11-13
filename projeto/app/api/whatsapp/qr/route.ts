import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STATUS_FILE = path.resolve("./public/whatsapp-status.json");

export async function GET() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return NextResponse.json({ qr: null });
    }

    const { qr } = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
    return NextResponse.json({ qr: qr || null });
  } catch (err) {
    return NextResponse.json({ qr: null });
  }
}
