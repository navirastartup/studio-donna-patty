import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmailConfirmation(
  email: string,
  nomeCliente: string,
  data: string,
  hora: string,
  servico: string,
  profissional: string,
  linkAgendamentos: string
) {
  const html = `
  <div style="font-family: Arial, sans-serif; background:#f8f8f8; padding:32px;">
    <div style="max-width:600px; margin:auto; background:white; padding:32px; border-radius:12px;">

      <h2 style="text-align:center; color:#d6c6aa; margin-top:0;">
        ✨ Confirmação de Agendamento ✨
      </h2>

      <p>Olá, <strong>${nomeCliente}</strong>!</p>

      <p>Seu agendamento foi confirmado com sucesso no <strong>Studio Donna Patty</strong>.</p>

      <div style="
        background:#fafafa;
        border-left:4px solid #d6c6aa;
        padding:16px;
        margin-top:16px;
      ">
        <p><strong>💇 Serviço:</strong> ${servico}</p>
        <p><strong>📅 Data:</strong> ${data}</p>
        <p><strong>⏰ Hora:</strong> ${hora}</p>
        <p><strong>👩‍🦰 Profissional:</strong> ${profissional}</p>
      </div>

      <div style="text-align:center; margin-top:28px;">
        <a
          href="${linkAgendamentos}"
          style="
            background:#d6c6aa;
            color:#000;
            padding:12px 28px;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;
            display:inline-block;
          "
        >
          🔗 Ver meus agendamentos
        </a>
      </div>

      <p style="margin-top:32px; font-size:12px; color:#777; text-align:center;">
        Este é um e-mail automático. Não responda.
      </p>

    </div>
  </div>
  `;

  await resend.emails.send({
    from: "Studio Donna Patty <no-reply@studiodonnapatty.site>",
    to: email,
    subject: `Confirmação de agendamento — ${servico}`,
    html,
  });
}
