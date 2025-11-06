import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

/**
 * Envia um e-mail de confirmação de agendamento.
 */
export async function sendEmailConfirmation(
  email: string,
  name: string,
  date: string,
  time: string,
  service: string
) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; background:#f8f8f8; padding:32px; border-radius:12px; max-width:600px; margin:auto;">
        <h2 style="color:#d6c6aa; text-align:center;">✨ Confirmação de Agendamento ✨</h2>
        <p style="font-size:16px; color:#333;">Olá, <strong>${name}</strong>!</p>
        <p style="font-size:16px; color:#333;">
          Seu agendamento foi confirmado com sucesso no <strong>Studio Donna Patty</strong>.
        </p>

        <div style="background:#fff; border-radius:8px; padding:16px; margin-top:16px; border:1px solid #eee;">
          <p><strong>💇‍♀️ Serviço:</strong> ${service}</p>
          <p><strong>📅 Data:</strong> ${date}</p>
          <p><strong>⏰ Hora:</strong> ${time}</p>
        </div>

        <p style="margin-top:24px; color:#555; font-size:14px;">
          Por favor, chegue com 10 minutos de antecedência. Caso precise reagendar, entre em contato conosco pelo WhatsApp.
        </p>

        <p style="margin-top:24px; font-weight:bold; color:#d6c6aa;">
          Studio Donna Patty 💖
        </p>
      </div>
    `;

    await resend.emails.send({
      from: "Studio Donna Patty <no-reply@studiodonnapatty.com>",
      to: email,
      subject: `Confirmação de agendamento — ${service}`,
      html,
    });

    console.log(`📧 E-mail de confirmação enviado para ${email}`);
  } catch (err) {
    console.error("❌ Erro ao enviar e-mail:", err);
  }
}
