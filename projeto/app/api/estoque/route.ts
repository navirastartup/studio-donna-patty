import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string | null;
}

// ------------------------------
// ✅ GET → lista produtos ou histórico
// ------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("product_id");

  try {
    if (productId) {
      // 📜 se tiver product_id → histórico de movimentações
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data });
    } else {
      // 📦 se não tiver → lista produtos
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;
      return NextResponse.json({ data });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ------------------------------
// ✅ Criar produto
// ------------------------------
export async function POST(req: Request) {
  try {
    const body: Product = await req.json();
    const { data, error } = await supabase.from("products").insert([body]).select();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ------------------------------
// ✅ Atualizar produto
// ------------------------------
export async function PUT(req: Request) {
  try {
    const body: Product = await req.json();
    if (!body.id) throw new Error("ID do produto é obrigatório para atualização");
    const { data, error } = await supabase.from("products").update(body).eq("id", body.id).select();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ------------------------------
// ✅ Deletar produto
// ------------------------------
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ------------------------------
// ✅ Movimentação de estoque
// ------------------------------
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { product_id, type, quantity, reason } = body;

    if (!product_id || !quantity) throw new Error("Produto e quantidade obrigatórios");

    // registra o movimento
    const { error: moveError } = await supabase
      .from("stock_movements")
      .insert([{ product_id, type, quantity, reason }]);
    if (moveError) throw moveError;

    // ajusta o estoque via RPC
    const sign = type === "in" ? "+" : "-";
    const { error: stockError } = await supabase.rpc("adjust_stock", {
      pid: product_id,
      qty: quantity,
      sign,
    });
    if (stockError) throw stockError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
