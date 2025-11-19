import { NextResponse } from "next/server";
import { Resend } from "resend";
// ⚙️ Inicializa Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// 💎 Template de e-mail premium (sem emojis)
function getEmailHTML({
  nomeCliente,
  data,
  hora,
  profissional,
  servico,
  linkAgendamento,
}: any) {
  return `
  <div style="
    font-family: 'Poppins', Arial, sans-serif;
    background-color: #f8f7f4;
    padding: 48px;
  ">
    <div style="
      max-width: 580px;
      margin: auto;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.05);
      overflow: hidden;
      border: 1px solid #eae7df;
    ">
      <div style="
        background: linear-gradient(90deg, #d6c6aa, #bfa575);
        padding: 32px 0;
        text-align: center;
      ">
        <h1 style="
          margin: 0;
          color: #222;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.5px;
        ">
          Studio Donna Patty
        </h1>
        <p style="
          margin: 6px 0 0;
          color: #222;
          font-weight: 500;
          font-size: 14px;
          letter-spacing: 0.3px;
          opacity: 0.9;
        ">
          Agendamento confirmado
        </p>
      </div>

      <div style="padding: 36px 44px;">
        <p style="font-size: 15px; color: #333; margin-top: 0;">
          Prezada <strong>${nomeCliente}</strong>,
        </p>

        <p style="font-size: 15px; color: #444; line-height: 1.6;">
          Seu agendamento foi confirmado com sucesso.
        </p>

        <div style="
          margin: 24px 0;
          border-left: 3px solid #d6c6aa;
          padding-left: 18px;
        ">
          <p style="margin: 8px 0; font-size: 14px; color: #333;">
            <strong>Data:</strong> ${data}
          </p>
          <p style="margin: 8px 0; font-size: 14px; color: #333;">
            <strong>Horário:</strong> ${hora}
          </p>
          <p style="margin: 8px 0; font-size: 14px; color: #333;">
            <strong>Profissional:</strong> ${profissional}
          </p>
          <p style="margin: 8px 0; font-size: 14px; color: #333;">
            <strong>Serviço:</strong> ${servico}
          </p>
        </div>

        <a
          href="${linkAgendamento}"
          style="
            display:inline-block;
            background: #d6c6aa;
            color: #1f1f1f;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            transition: background 0.3s ease;
          "
        >
          Ver meu agendamento
        </a>

        <p style="
          margin-top: 36px;
          font-size: 12.5px;
          color: #777;
          text-align: center;
          border-top: 1px solid #eee;
          padding-top: 20px;
        ">
          Este é um e-mail automático. Por favor, não responda.<br>
          Equipe Studio Donna Patty.
        </p>
      </div>
    </div>
  </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      nomeCliente,
      data,
      hora,
      profissional,
      servico,
      emailCliente,
      whatsapp,
      linkAgendamento,
    } = body;

    if (!emailCliente) {
      return NextResponse.json(
        { error: "E-mail do cliente é obrigatório" },
        { status: 400 }
      );
    }

    // ✉️ Envia o e-mail pelo Resend
    const email = await resend.emails.send({
      from: "Studio Donna Patty <onboarding@resend.dev>",
      to: emailCliente,
      subject: "Agendamento Confirmado — Studio Donna Patty",
      html: getEmailHTML({
        nomeCliente,
        data,
        hora,
        profissional,
        servico,
        linkAgendamento,
      }),
    });

    // 📩 Log do WhatsApp (simulação)
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mensagem enviada para ${whatsapp || "sem número"}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: ${nomeCliente}
Data: ${data} às ${hora}
Serviço: ${servico}
Profissional: ${profissional}
Link: ${linkAgendamento}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    async function sendWhatsAppMessageMock() {
      console.log("📵 WhatsApp desativado no deploy — mock executado.");
    }
    
    // substitui o bot REAL por um mock seguro para deploy
const sendWhatsAppMessage = sendWhatsAppMessageMock;


    return NextResponse.json({ success: true, email });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Erro ao enviar notificação" },
      { status: 500 }
    );
  }
}
