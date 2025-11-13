import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp-bot.mjs";

export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json();
    if (!phone || !message) {
      return NextResponse.json({ error: "phone e message são obrigatórios" }, { status: 400 });
    }

    await sendWhatsAppMessage(phone, message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err);
    return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 });
  }
}
