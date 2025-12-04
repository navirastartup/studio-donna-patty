import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const { id, status, payment_status, oldDate, newDate, clientName } =
      await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID ausente" },
        { status: 400 }
      );
    }

    // Mapa status PT-BR
    const mapStatus: Record<string, string> = {
      pending: "pendente",
      confirmed: "confirmado",
      cancelled: "cancelado",
      completed: "concluido",
      rescheduled: "reagendado",
    };

    const mapPay: Record<string, string> = {
      pending: "pendente",
      paid: "pago",
      failed: "falhou",
    };

    const payload: any = {};

    if (status) payload.status = mapStatus[status] || status;
    if (payment_status) payload.payment_status = mapPay[payment_status] || payment_status;

    // Atualiza agendamento
    const { error } = await admin
      .from("appointments")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    // 🔔 Criar notificação de reagendamento no admin
    if (status === "rescheduled" && clientName && oldDate && newDate) {
      await admin.from("admin_notifications").insert({
        type: "reschedule",
        message: `🔁 ${clientName} reagendou (${oldDate} → ${newDate})`,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Erro atualização:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
