import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fs = require("fs");
    const path = "./public/whatsapp-status.json";

    if (!fs.existsSync(path)) {
      return NextResponse.json({ connected: false });
    }

    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ connected: false });
  }
}
