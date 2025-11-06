// app/api/invoices/delete/route.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ use a service key, não a anon
);

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return Response.json({ error: "ID da fatura não fornecido" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("invoices").delete().eq("id", id);

    if (error) {
      console.error("Erro Supabase ao deletar:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Erro geral ao deletar fatura:", err);
    return Response.json({ error: "Erro interno ao deletar fatura" }, { status: 500 });
  }
}
