// lib/notify-email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * E-mail de confirmação de agendamento
 *
 * @param email            E-mail do cliente
 * @param nomeCliente      Nome do cliente
 * @param data             Data formatada (dd/mm/aaaa)
 * @param hora             Hora formatada (hh:mm)
 * @param servico          Nome do serviço
 * @param profissional     Nome do profissional
 * @param linkAgendamento  Link /minha-agenda/{client_id}
 */
export async function sendEmailConfirmation(
  email: string,
  nomeCliente: string,
  data: string,
  hora: string,
  servico: string,
  profissional: string,
  linkAgendamento: string
) {
  const html = `
    <div style="background:#05070b;padding:40px;font-family:Poppins,Arial,sans-serif">
      <div style="
        max-width:640px;
        margin:auto;
        background:#0d1117;
        border-radius:16px;
        border:1px solid #1f2535;
        overflow:hidden;
      ">
        <!-- Header -->
        <div style="padding:28px 32px;border-bottom:1px solid #1f2535;text-align:center">
          <h1 style="margin:0;color:#D6C6AA;font-size:22px;font-weight:600;">
            ✨ Confirmação de Agendamento ✨
          </h1>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:13px;">
            Seu horário foi reservado com sucesso no <strong style="color:#E5DCC5;">Studio Donna Patty</strong>.
          </p>
        </div>

        <!-- Conteúdo -->
        <div style="padding:28px 32px;color:#e5e7eb;font-size:14px;line-height:1.7;">
          <p style="margin-top:0;">
            Olá, <strong style="color:#fff;">${nomeCliente}</strong>!
          </p>

          <p>
            Seu agendamento foi confirmado com os seguintes detalhes:
          </p>

          <div style="
            margin:18px 0 22px;
            padding:18px 16px;
            background:#111827;
            border-radius:12px;
            border:1px solid #1f2937;
          ">
            <p style="margin:4px 0;"><strong>Serviço:</strong> ${servico}</p>
            <p style="margin:4px 0;"><strong>Profissional:</strong> ${profissional}</p>
            <p style="margin:4px 0;"><strong>Data:</strong> ${data}</p>
            <p style="margin:4px 0;"><strong>Horário:</strong> ${hora}</p>
          </div>

          <p style="margin-bottom:20px;">
            Caso precise reagendar, você pode falar conosco pelo WhatsApp
            ou acessar seus agendamentos pelo botão abaixo:
          </p>

          <div style="text-align:center;margin-bottom:10px;">
            <a
              href="${linkAgendamento}"
              style="
                display:inline-block;
                padding:12px 28px;
                border-radius:999px;
                background:#D6C6AA;
                color:#111827;
                font-weight:600;
                font-size:14px;
                text-decoration:none;
              "
            >
              Ver meus agendamentos
            </a>
          </div>

          <p style="margin-top:22px;font-size:12px;color:#9ca3af;text-align:center;">
            Recomendamos chegar com <strong>10 minutos de antecedência</strong> para o melhor atendimento. 💜
          </p>
        </div>

        <!-- Rodapé -->
        <div style="padding:14px 24px;border-top:1px solid #1f2535;text-align:center;">
          <p style="margin:0;color:#6b7280;font-size:11px;">
            Studio Donna Patty · Este é um e-mail automático, por favor não responda.
          </p>
        </div>
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
