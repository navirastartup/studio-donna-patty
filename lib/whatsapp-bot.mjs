import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import fs from "fs";

const AUTH_FOLDER = "./whatsapp_auth";
const STATUS_FILE = "./public/whatsapp-status.json";

let sock = null; // 🟢 Guarda a sessão global
let starting = false; // ⛔ Evita múltiplos starts

function saveStatus(status) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch {}
}

export async function startBot() {
  if (starting || sock) return sock; // ⛔ Impede reconexão duplicada
  starting = true;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) {
      saveStatus({ connected: false, awaitingScan: true, qr });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp conectado");
      saveStatus({
        connected: true,
        awaitingScan: false,
        qr: null,
        number: sock.user?.id?.split("@")[0] || null,
      });
    }

    if (connection === "close") {
      console.log("⚠️ Conexão perdida. Aguardando reconexão manual.");
      saveStatus({ connected: false, awaitingScan: false, qr: null });
      sock = null;
      starting = false;
    }
  });

  starting = false;
  return sock;
}

export async function sendWhatsAppMessage(phone, message) {
  // Se não tem conexão, tenta subir
  if (!sock) {
    console.log("⚠️ Bot não estava ativo — iniciando...");
    await startBot();
  }

  // Aguarda o socket estar pronto
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (!sock) {
    console.log("❌ Bot ainda não iniciou.");
    return;
  }

  try {
    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    await sock.sendMessage(jid, { text: message });
    console.log("✅ Mensagem enviada para:", jid);
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err);
  }
}

startBot();
