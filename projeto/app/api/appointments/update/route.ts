import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // NUNCA expor no client
const admin = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const { id, status, payment_status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID ausente" }, { status: 400 });
    }

    // mapeia status do front se vier em inglês (opcional)
    const mapStatus = (s?: string) => {
      if (!s) return undefined;
      const m: Record<string, string> = {
        pending: "pendente",
        confirmed: "confirmado",
        cancelled: "cancelado",
        completed: "concluido",
      };
      return m[s] || s;
    };

    const mapPay = (s?: string) => {
      if (!s) return undefined;
      const m: Record<string, string> = {
        pending: "pendente",
        paid: "pago",
        cancelled: "cancelado",
        refunded: "reembolsado",
      };
      return m[s] || s;
    };

    const payload: any = {};
    const sPT = mapStatus(status);
    const pPT = mapPay(payment_status);
    if (sPT) payload.status = sPT;
    if (pPT) payload.payment_status = pPT;

    const { error } = await admin
      .from("appointments")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    // ⚠️ o trigger no banco já cria o payment se payment_status='pago'
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("update appointment error:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
