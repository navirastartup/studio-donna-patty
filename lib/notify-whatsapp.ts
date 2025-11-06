const DEFAULT_COUNTRY_CODE = "55";

function normalizeBrazilianNumber(raw: string): string {
  const digits = raw?.replace(/\D/g, "") ?? "";
  if (!digits) {
    throw new Error("Número de telefone ausente para envio via WhatsApp.");
  }

  let withoutCountry = digits;
  if (withoutCountry.startsWith(DEFAULT_COUNTRY_CODE)) {
    withoutCountry = withoutCountry.slice(DEFAULT_COUNTRY_CODE.length);
  }

  if (withoutCountry.length < 10) {
    throw new Error(`Número de telefone inválido: ${raw}`);
  }

  return `${DEFAULT_COUNTRY_CODE}${withoutCountry}`;
}

export async function sendWhatsAppConfirmation(
  phone: string,
  name: string,
  date: string,
  time: string,
  service: string,
): Promise<void> {
  if (typeof window !== "undefined") {
    console.warn("⚠️ Tentativa de enviar WhatsApp no client bloqueada.");
    return;
  }

  try {
    const { sendWhatsAppMessage } = await import("./whatsapp-bot.js");

    const finalNumber = normalizeBrazilianNumber(phone);

    const message =
      `✅ Olá ${name}! Seu agendamento para *${service}* foi confirmado.\n` +
      `📅 Data: ${date}\n` +
      `⏰ Horário: ${time}\n` +
      `Nos vemos em breve!`;

    await sendWhatsAppMessage(finalNumber, message);
  } catch (error) {
    console.error("❌ Erro ao enviar WhatsApp via bot:", error);
    throw error;
  }
}
