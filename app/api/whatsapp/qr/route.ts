import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import qrcode from "qrcode";

export async function GET() {
  try {
    const qrFilePath = path.resolve("./public/whatsapp-qr.txt");
    if (!fs.existsSync(qrFilePath)) {
      return NextResponse.json({ qr: null, message: "QR ainda não gerado" });
    }

    const qrData = fs.readFileSync(qrFilePath, "utf8");
    const qrImage = await qrcode.toDataURL(qrData); // converte pra base64

    return NextResponse.json({ qr: qrImage });
  } catch (error: any) {
    console.error("Erro ao gerar QR:", error);
    return NextResponse.json({ error: "Falha ao carregar QR" }, { status: 500 });
  }
}
