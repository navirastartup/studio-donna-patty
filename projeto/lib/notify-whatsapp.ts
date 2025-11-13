const DEFAULT_COUNTRY_CODE = "55";

function normalizeBrazilianNumber(raw: string): string {
  const digits = raw?.replace(/\D/g, "") ?? "";
  if (!digits) throw new Error("Número de telefone ausente.");

  // Remove código do país se já tiver
  let num = digits.startsWith(DEFAULT_COUNTRY_CODE)
    ? digits.slice(DEFAULT_COUNTRY_CODE.length)
    : digits;

  if (num.length < 10) throw new Error(`Telefone inválido: ${raw}`);

  return `${DEFAULT_COUNTRY_CODE}${num}`;
}

export async function sendWhatsAppConfirmation(
  phone: string,
  name: string,
  date: string,
  time: string,
  service: string
): Promise<void> {
  // Não deixa rodar no client
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

await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send`,{
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: cleaned, message }),
});


    console.log("✅ WhatsApp enviado com sucesso!");
  } catch (err) {
    console.log("❌ Erro ao enviar WhatsApp:", err);
  }
}
