import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = `${process.env.NEXT_PUBLIC_BOT_URL}/status.json`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch bot status");
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err) {
    console.error("Bot status error:", err);
    return NextResponse.json({ error: "Bot offline" }, { status: 500 });
  }
}
