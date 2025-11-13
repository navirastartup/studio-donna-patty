// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Preference } from "mercadopago";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { serviceId, professionalId, client, startTime, endTime, price, policy } = body;

    if (!serviceId || !professionalId || !client?.email || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Dados incompletos para criar o agendamento." },
        { status: 400 }
      );
    }

    // cliente
    let { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("email", client.email)
      .single();

    if (!clientData) {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert([{ full_name: client.name, email: client.email, phone: client.phone }])
        .select("id")
        .single();
      if (clientError) throw clientError;
      clientData = newClient;
    }
    const clientId = clientData.id;

    // serviço
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();
    if (serviceError || !service) throw new Error("Serviço não encontrado.");

    // status inicial conforme política
    const status =
      policy === "none" ? "confirmado" : "pendente";
    const payment_status =
      policy === "none" ? "isento" : "pendente";

    // cria appointment
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .insert({
        service_id: serviceId,
        professional_id: professionalId,
        client_id: clientId,
        client_email: client.email,
        start_time: startTime,
        end_time: endTime,
        status,
        payment_status,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (appointmentError) throw appointmentError;

    const appointmentId = appointment.id;

    // SEM pagamento — devolve sucesso já
    if (policy === "none") {
      return NextResponse.json({
        success: true,
        appointment: { id: appointmentId },
      });
    }

    // MP preference
    const preference = new Preference(mp);
    const pref = await preference.create({
      body: {
        items: [
          {
            id: service.id,
            title: service.name,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(price || service.price || 0),
          },
        ],
        payer: {
          name: client.name,
          email: client.email,
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_BASE_URL}/success?appointment_id=${appointmentId}`,
          failure: `${process.env.NEXT_PUBLIC_BASE_URL}/failure?appointment_id=${appointmentId}`,
          pending: `${process.env.NEXT_PUBLIC_BASE_URL}/pending?appointment_id=${appointmentId}`,
        },
        auto_return: "approved",
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mercadopago/webhook`,
        metadata: {
          appointment_id: appointmentId,
          client_email: client.email,
          service_id: serviceId,
          professional_id: professionalId,
          policy: policy || "full",
        },
      },
    });

    // atualiza preference_id
    await supabaseAdmin
      .from("appointments")
      .update({ preference_id: pref.id })
      .eq("id", appointmentId);

    return NextResponse.json({
      success: true,
      init_point: pref.init_point,
      preference_id: pref.id,
    });
  } catch (err: any) {
    console.error("❌ Erro no checkout:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
