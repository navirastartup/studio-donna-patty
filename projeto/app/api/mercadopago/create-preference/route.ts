import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { servico, preco, appointmentId } = body;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_BASE_URL não está definida no .env.local");
    }

    const preferenceData = {
      items: [
        {
          title: servico,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(preco),
        },
      ],
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL}/failure`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL}/pending`,
      },
      auto_return: "approved", // ✅ redireciona automaticamente quando o pagamento é aprovado
      external_reference: appointmentId,
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mercadopago/webhook`, // ✅ seu webhook recebe o evento
    };    

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro Mercado Pago:", errorText);
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    const data = await response.json();
    console.log("✅ Preferência criada com sucesso:", data.id);

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("❌ Erro create-preference:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
