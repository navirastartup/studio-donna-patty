import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

export const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("🔐 Escaneie o QR Code abaixo para conectar o WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp conectado com sucesso!");
});

client.initialize();
