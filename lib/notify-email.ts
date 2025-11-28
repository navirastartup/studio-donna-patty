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
        <!-- HEADER -->
        <div style="
          padding:20px 28px;
          border-bottom:1px solid #1f2535;
          display:flex;
          align-items:center;
          justify-content:space-between;
        ">
          <div>
            <div style="color:#9ca3af;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">
              Confirmação de agendamento
            </div>
            <h1 style="margin:4px 0 0;color:#D6C6AA;font-size:20px;font-weight:600;">
              Studio Donna Patty
            </h1>
          </div>
          <div style="
            width:34px;
            height:34px;
            border-radius:999px;
            border:1px solid #2b3243;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:16px;
            color:#D6C6AA;
          ">
            ✓
          </div>
        </div>

        <!-- CONTEÚDO -->
        <div style="padding:26px 28px;color:#e5e7eb;font-size:14px;line-height:1.7;">
          <p style="margin:0 0 12px;">
            Olá, <strong style="color:#ffffff;">${nomeCliente}</strong>.
          </p>

          <p style="margin:0 0 18px;">
            Seu horário foi confirmado com os dados abaixo:
          </p>

          <!-- BLOCO DE DETALHES -->
          <div style="
            margin:0 0 22px;
            padding:16px 18px;
            background:#111827;
            border-radius:12px;
            border:1px solid #1f2937;
          ">
            <p style="margin:4px 0;">
              <span style="display:inline-block;width:18px;color:#D6C6AA;">■</span>
              <strong>Serviço:</strong> ${servico}
            </p>
            <p style="margin:4px 0;">
              <span style="display:inline-block;width:18px;color:#D6C6AA;">■</span>
              <strong>Profissional:</strong> ${profissional}
            </p>
            <p style="margin:4px 0;">
              <span style="display:inline-block;width:18px;color:#D6C6AA;">■</span>
              <strong>Data:</strong> ${data}
            </p>
            <p style="margin:4px 0;">
              <span style="display:inline-block;width:18px;color:#D6C6AA;">■</span>
              <strong>Horário:</strong> ${hora}
            </p>
          </div>

          <p style="margin:0 0 16px;">
            Caso precise alterar ou cancelar, entre em contato com o Studio Donna Patty
            com antecedência ou acesse seus agendamentos pelo link abaixo.
          </p>

          <div style="text-align:center;margin:18px 0 4px;">
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
              Acessar meus agendamentos
            </a>
          </div>

          <p style="margin-top:18px;font-size:12px;color:#9ca3af;text-align:center;">
            Recomendamos chegar com alguns minutos de antecedência para um atendimento tranquilo.
          </p>
        </div>

        <!-- RODAPÉ -->
        <div style="padding:12px 24px;border-top:1px solid #1f2535;text-align:center;">
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
