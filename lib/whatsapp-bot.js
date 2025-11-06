import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// Caminho absoluto pro QR salvo
const qrFilePath = path.resolve("./public/whatsapp-qr.txt");

// Inicializa o cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", 
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });
  
// Escuta quando o QR é gerado
client.on("qr", (qr) => {
  try {
    fs.writeFileSync(qrFilePath, qr); // salva o QR em arquivo público
    console.clear();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📱 Escaneie o QR Code abaixo com o WhatsApp da Donna Patty:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    qrcode.generate(qr, { small: true });
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ QR salvo em:", qrFilePath);
  } catch (err) {
    console.error("❌ Erro ao salvar QR:", err);
  }
});

client.on("ready", () => {
    fs.writeFileSync("./public/whatsapp-status.json", JSON.stringify({
      connected: true,
      number: client.info.wid.user
    }));
  });
  
  client.on("disconnected", () => {
    fs.writeFileSync("./public/whatsapp-status.json", JSON.stringify({ connected: false }));
  });
  

// Se desconectar, mostra aviso
client.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp desconectado:", reason);
});

// Inicializa o cliente
client.initialize();

/**
 * Envia mensagem pelo WhatsApp conectado
 * @param {string} to - número no formato internacional (ex: "557399999999@c.us")
 * @param {string} message - conteúdo da mensagem
 */
export async function sendWhatsAppMessage(to, message) {
  if (!client || !client.info) {
    console.log("❌ Cliente WhatsApp ainda não conectado.");
    return;
  }

  try {
    // Normaliza número
    let formatted = String(to).trim();
    if (!formatted.endsWith("@c.us")) {
      formatted = formatted.replace(/\D/g, "") + "@c.us";
    }

    await client.sendMessage(formatted, message);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mensagem enviada via WhatsApp:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para: ${formatted}
----------------------------------------
${message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem via WhatsApp:", error);
  }
}
