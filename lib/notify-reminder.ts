// lib/notify-reminder.ts
import { Resend } from "resend";

export type ReminderType = "24h" | "1h";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Assunto por tipo
const SUBJECTS: Record<ReminderType, string> = {
  "24h": "Lembrete: seu agendamento é amanhã ✨",
  "1h": "Seu horário é em breve ⏰",
};

// Mensagem por tipo
const MESSAGES: Record<ReminderType, string> = {
  "24h": `
      Seu atendimento no Studio Donna Patty é amanhã.
      Caso precise reagendar, basta falar conosco.
  `,
  "1h": `
      Seu horário está chegando em breve.
      Tudo certo para o seu atendimento?
  `,
};

interface SendReminderArgs {
  type: ReminderType;
  client: {
    full_name: string;
    email: string;
  };
  service: string;
  professional: string;
  date: string; // YYYY-MM-DD
  hour: string; // HH:mm
}

export async function sendReminderEmail({
  type,
  client,
  service,
  professional,
  date,
  hour,
}: SendReminderArgs) {
  if (!client?.email) return;

  const html = `
    <div style="background:#05070b;padding:40px;font-family:Poppins,Arial,sans-serif">
      <div style="max-width:600px;margin:auto;background:#0d1117;border:1px solid #1f2535;border-radius:14px;overflow:hidden">
        
        <div style="padding:32px;text-align:center;border-bottom:1px solid #1f2535">
          <h1 style="color:#D6C6AA;margin:0;font-size:22px;font-weight:600">Studio Donna Patty</h1>
          <p style="color:#aaa;font-size:14px;margin-top:6px">Lembrete de agendamento</p>
        </div>

        <div style="padding:32px;color:#ccc;font-size:15px;line-height:1.6">
          Olá, <strong style="color:#fff">${client.full_name}</strong>!<br><br>

          ${MESSAGES[type]}

          <div style="margin-top:20px;padding:16px;background:#111725;border-left:3px solid #D6C6AA;border-radius:8px">
            <p><strong>Serviço:</strong> ${service}</p>
            <p><strong>Profissional:</strong> ${professional}</p>
            <p><strong>Data:</strong> ${date.split("-").reverse().join("/")}</p>
            <p><strong>Horário:</strong> ${hour}</p>
          </div>
        </div>

        <p style="color:#666;font-size:12px;text-align:center;border-top:1px solid #1f2535;padding:16px">
          Studio Donna Patty • Não responda este e-mail.
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: "Studio Donna Patty <no-reply@studiodonnapatty.site>",
    to: client.email,
    subject: SUBJECTS[type],
    html,
  });
}
