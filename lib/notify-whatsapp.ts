export function normalizeBrazilianNumber(phone: string) {
  let clean = phone.replace(/\D/g, "");

  // Se começar com 0, remove
  if (clean.startsWith("0")) clean = clean.substring(1);

  // Se não tiver DDI, adiciona
  if (!clean.startsWith("55")) clean = "55" + clean;

  return clean;
}

export async function sendWhatsAppConfirmation(
  phone: string,
  name: string,
  date: string,
  time: string,
  service: string
) {
  if (typeof window !== "undefined") return;

  try {
    const cleaned = normalizeBrazilianNumber(phone);

    const message = `
✨ *Agendamento Confirmado!* ✨

Olá *${name}*! Seu horário está marcado ✅

🛍 *Serviço:* ${service}
📅 *Data:* ${date}
⏰ *Horário:* ${time}

Obrigada por escolher o *Studio Donna Patty* 💖
Até breve!
`;

    await fetch(`${process.env.NEXT_PUBLIC_BOT_URL}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleaned, message }),
    });

    console.log("WhatsApp enviado");
  } catch (err) {
    console.log("Erro ao enviar WhatsApp:", err);
  }
}
