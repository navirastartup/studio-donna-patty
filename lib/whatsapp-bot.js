import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

const AUTH_DATA_PATH = "./.wwebjs_auth";
const PUBLIC_DIR = path.resolve("./public");
const QR_FILE_PATH = path.join(PUBLIC_DIR, "whatsapp-qr.txt");
const STATUS_FILE_PATH = path.join(PUBLIC_DIR, "whatsapp-status.json");
const EXPECTED_SENDER_NUMBER = (process.env.WHATSAPP_SENDER_NUMBER ?? "73982065794").replace(/\D/g, "");

function ensurePublicDir() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
}

function writeStatus(status) {
  try {
    ensurePublicDir();
    fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(status, null, 2));
  } catch (error) {
    console.error("❌ Erro ao salvar status do WhatsApp:", error);
  }
}

function saveQrCode(qr) {
  try {
    ensurePublicDir();
    fs.writeFileSync(QR_FILE_PATH, qr);
    console.clear();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📱 Escaneie o QR Code abaixo com o WhatsApp da Donna Patty:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    qrcode.generate(qr, { small: true });
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ QR salvo em:", QR_FILE_PATH);
  } catch (error) {
    console.error("❌ Erro ao salvar QR:", error);
  }
}

function clearQrCode() {
  try {
    if (fs.existsSync(QR_FILE_PATH)) {
      fs.unlinkSync(QR_FILE_PATH);
    }
  } catch (error) {
    console.error("❌ Erro ao remover QR antigo:", error);
  }
}

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

let readyDeferred = createDeferred();
let initializing = false;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DATA_PATH }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

function startClient() {
  if (initializing) return;
  initializing = true;

  client
    .initialize()
    .catch((error) => {
      console.error("❌ Erro ao inicializar cliente WhatsApp:", error);
      readyDeferred.reject?.(error);
    })
    .finally(() => {
      initializing = false;
    });
}

client.on("qr", (qr) => {
  saveQrCode(qr);
  writeStatus({ connected: false, awaitingScan: true });
});

client.on("ready", () => {
  clearQrCode();

  const connectedNumber = client.info?.wid?.user ?? "";
  writeStatus({ connected: true, number: connectedNumber });

  if (EXPECTED_SENDER_NUMBER && connectedNumber && connectedNumber !== EXPECTED_SENDER_NUMBER) {
    console.error(
      "⚠️ WhatsApp conectado em um número diferente do esperado.",
      `Esperado: ${EXPECTED_SENDER_NUMBER} | Recebido: ${connectedNumber}`,
    );
  } else {
    console.log(`✅ WhatsApp conectado ao número: ${connectedNumber || "(desconhecido)"}`);
  }

  readyDeferred.resolve?.();
});

client.on("auth_failure", (message) => {
  console.error("❌ Falha de autenticação do WhatsApp:", message);
  readyDeferred.reject?.(new Error("Falha de autenticação do WhatsApp"));
});

client.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp desconectado:", reason);
  writeStatus({ connected: false, reason });
  readyDeferred.reject?.(new Error(`WhatsApp desconectado: ${reason}`));
  readyDeferred = createDeferred();
  startClient();
});

startClient();

async function ensureClientReady() {
  try {
    await readyDeferred.promise;
  } catch (error) {
    console.error("❌ Cliente WhatsApp indisponível:", error);
    throw new Error(
      "Cliente WhatsApp indisponível. Verifique a sessão no WhatsApp Web e tente novamente.",
    );
  }
}

export async function sendWhatsAppMessage(to, message) {
  await ensureClientReady();

  if (!client.info) {
    throw new Error("Cliente WhatsApp não está conectado.");
  }

  let formatted = String(to ?? "").trim();
  if (!formatted) {
    throw new Error("Número de destino vazio para WhatsApp.");
  }

  if (!formatted.endsWith("@c.us")) {
    formatted = formatted.replace(/\D/g, "");

    if (!formatted) {
      throw new Error("Número de destino inválido para WhatsApp.");
    }

    if (!formatted.startsWith("55")) {
      formatted = `55${formatted}`;
    }

    formatted = `${formatted}@c.us`;
  }

  await client.sendMessage(formatted, message);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMensagem enviada via WhatsApp:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPara: ${formatted}\n----------------------------------------\n${message}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

export function getWhatsAppStatus() {
  try {
    ensurePublicDir();

    if (!fs.existsSync(STATUS_FILE_PATH)) {
      return { connected: false };
    }

    const raw = fs.readFileSync(STATUS_FILE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("❌ Erro ao ler status do WhatsApp:", error);
    return { connected: false };
  }
}
