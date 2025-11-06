"use client";

import { useEffect, useReducer, useState } from "react";
import {
  PlusCircle,
  Edit,
  Trash2,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  ScrollText,
  Search,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { useLowStock } from "../LowStockContext";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string | null;
}
type MovementType = "in" | "out";

async function fetchJSON<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Erro na requisição");
  return payload as T;
}
const formatBRL = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

export default function AdminEstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { reloadLowStock } = useLowStock();

  const [modal, setModal] = useState<{
    type: "product" | "movement" | "history" | null;
    product?: Product | null;
    movementType?: MovementType | null;
  }>({ type: null, product: null, movementType: null });

  type FormState = { name: string; description: string; price: string; stock: string; image_url: string | null };
  type FormAction =
    | { type: "patch"; payload: Partial<FormState> }
    | { type: "fromProduct"; payload: Product }
    | { type: "reset" };
  const initialForm: FormState = { name: "", description: "", price: "", stock: "", image_url: null };

  function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
      case "patch": return { ...state, ...action.payload };
      case "fromProduct":
        return {
          name: action.payload.name,
          description: action.payload.description || "",
          price: String(action.payload.price ?? ""),
          stock: String(action.payload.stock ?? ""),
          image_url: action.payload.image_url || null,
        };
      case "reset": return { ...initialForm };
      default: return state;
    }
  }

  const [form, dispatchForm] = useReducer(formReducer, initialForm);
  const [movementQty, setMovementQty] = useState("");
  const [movementReason, setMovementReason] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetchJSON<{ data: Product[] }>("/api/estoque", { cache: "no-store" });
      setProducts(res.data ?? []);
      reloadLowStock();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    const ql = q.trim().toLowerCase();
    let list = products.filter(
      (p) =>
        p.name.toLowerCase().includes(ql) ||
        (p.description || "").toLowerCase().includes(ql) ||
        String(p.price).includes(ql)
    );

    if (filtro === "estoque") list = list.filter((p) => p.stock > 0);
    else if (filtro === "baixo") list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (filtro === "sem") list = list.filter((p) => p.stock === 0);

    setFiltered(list);
  }, [q, products, filtro]);

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      stock: parseInt(form.stock, 10),
      image_url: form.image_url,
      ...(modal.product ? { id: modal.product.id } : {}),
    };
    if (!body.name) return setError("Nome é obrigatório");
    if (Number.isNaN(body.price)) return setError("Preço inválido");
    if (!modal.product && Number.isNaN(body.stock)) return setError("Estoque inicial inválido");

    await fetchJSON("/api/estoque", {
      method: modal.product ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async () => {
      setModal({ type: null });
      await loadProducts();
    }).catch((e) => setError(e.message));
  }

  async function removeProduct(id: string) {
    if (!confirm("Deseja realmente deletar este produto?")) return;
    await fetchJSON("/api/estoque", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then(() => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      reloadLowStock();
    }).catch((e) => setError(e.message));
  }

  async function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal.product) return;
    const qty = parseInt(movementQty, 10);
    if (!qty || qty < 1) return setError("Quantidade inválida");

    await fetchJSON("/api/estoque", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: modal.product.id,
        type: modal.movementType,
        quantity: qty,
        reason: movementReason || null,
      }),
    }).then(() => {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === modal.product!.id
            ? { ...p, stock: modal.movementType === "in" ? p.stock + qty : Math.max(p.stock - qty, 0) }
            : p
        )
      );
      reloadLowStock();
      setMovementQty("");
      setMovementReason("");
      setModal({ type: null });
    }).catch((e) => setError(e.message));
  }

  if (loading) return <p className="text-[#D6C6AA]">Carregando estoque...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#D6C6AA]">Controle de Estoque</h2>
          <p className="text-sm text-gray-400">Gerencie produtos e movimentações</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, descrição..."
              className="bg-transparent outline-none text-sm placeholder:text-gray-500 w-64"
            />
          </div>
          <button
            onClick={() => { dispatchForm({ type: "reset" }); setModal({ type: "product" }); }}
            className="inline-flex items-center gap-2 bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#e5d8c2] transition"
          >
            <PlusCircle className="w-5 h-5" /> Adicionar Produto
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl text-center">
          <p className="text-gray-400 text-sm">Produtos cadastrados</p>
          <p className="text-2xl font-bold text-[#D6C6AA]">{products.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl text-center">
          <p className="text-gray-400 text-sm">Baixo estoque</p>
          <p className="text-2xl font-bold text-yellow-400">
            {products.filter((p) => p.stock > 0 && p.stock <= 5).length}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl text-center">
          <p className="text-gray-400 text-sm">Sem estoque</p>
          <p className="text-2xl font-bold text-red-500">
            {products.filter((p) => p.stock === 0).length}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mt-2">
        {[
          { key: "todos", label: "Todos" },
          { key: "estoque", label: "Com Estoque" },
          { key: "baixo", label: "Baixo Estoque" },
          { key: "sem", label: "Sem Estoque" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === key
                ? "bg-[#D6C6AA] text-black"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0f1624]">
        <div className="divide-y divide-gray-800">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum produto encontrado.</p>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="grid grid-cols-[80px_1.2fr_1fr_120px_160px_280px] gap-4 px-5 py-4 items-center hover:bg-[#0e1a2b] transition">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800">
                  <img src={p.image_url || "https://via.placeholder.com/80x80/333/d6c6aa?text=📦"} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-gray-500">ID: {p.id.slice(0, 8)}…</div>
                </div>
                <div className="text-gray-400 text-sm truncate">{p.description?.trim() || "-"}</div>
                <div className="text-right text-[#D6C6AA] font-semibold">{formatBRL(p.price)}</div>
                <div className={`text-sm font-medium ${
                  p.stock === 0
                    ? "text-red-500 animate-pulse"
                    : p.stock === 1
                    ? "text-red-500 animate-bounce font-bold"
                    : p.stock <= 5
                    ? "text-yellow-400 animate-pulse"
                    : "text-green-400"
                }`}>
                  {p.stock === 0
                    ? "Sem estoque"
                    : p.stock === 1
                    ? `⚠️ ESTOQUE BAIXÍSSIMO (${p.stock})`
                    : p.stock <= 5
                    ? `⚠️ Estoque Baixo (${p.stock})`
                    : `Em estoque: ${p.stock}`}
                </div>
                <div className="flex justify-end gap-2">
                  {[
                    {icon: Edit,color: "bg-blue-600 hover:bg-blue-700",action: () => {dispatchForm({ type: "fromProduct", payload: p });setModal({ type: "product", product: p });},},

                    { icon: ArrowUpCircle, color: "bg-green-600 hover:bg-green-700", action: () => setModal({ type: "movement", product: p, movementType: "in" }) },
                    { icon: ArrowDownCircle, color: "bg-yellow-600 hover:bg-yellow-700", action: () => setModal({ type: "movement", product: p, movementType: "out" }) },
                    { icon: ScrollText, color: "bg-purple-600 hover:bg-purple-700", action: () => setModal({ type: "history", product: p }) },
                    { icon: Trash2, color: "bg-red-600 hover:bg-red-700", action: () => removeProduct(p.id) },
                  ].map(({ icon: Icon, color, action }, i) => (
                    <button key={i} onClick={action} className={`w-8 h-8 flex items-center justify-center rounded-md ${color}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modais */}
      {modal.type === "product" && (
        <ModalProduto {...{ modal, form, dispatchForm, handleSaveProduct, setModal, error }} />
      )}
      {modal.type === "movement" && modal.product && (
        <ModalMovimento {...{ modal, handleMovementSubmit, movementQty, setMovementQty, movementReason, setMovementReason, error, setModal }} />
      )}
      {modal.type === "history" && modal.product && (
        <MovementHistory productId={modal.product.id} onClose={() => setModal({ type: null })} />
      )}
    </div>
  );
}

/* Modal Produto */
function ModalProduto({ modal, form, dispatchForm, handleSaveProduct, setModal, error }: any) {
  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md relative border border-gray-800">
        <button
          onClick={() => setModal({ type: null })}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-[#D6C6AA] mb-4 text-center">
          {modal.product ? "Editar Produto" : "Adicionar Produto"}
        </h2>

        <form onSubmit={handleSaveProduct} className="space-y-4">
          <input
            type="text"
            placeholder="Nome"
            value={form.name}
            onChange={(e) =>
              dispatchForm({ type: "patch", payload: { name: e.target.value } })
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            required
          />

          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) =>
              dispatchForm({ type: "patch", payload: { description: e.target.value } })
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />

          <input
            type="number"
            step="0.01"
            placeholder="Preço"
            value={form.price}
            onChange={(e) =>
              dispatchForm({ type: "patch", payload: { price: e.target.value } })
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            required
          />

          <input
            type="number"
            placeholder="Estoque inicial"
            value={form.stock}
            onChange={(e) =>
              dispatchForm({ type: "patch", payload: { stock: e.target.value } })
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            required
            disabled={!!modal.product}
          />

          {/* Upload da Imagem */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Foto do produto</label>
            <ImageUpload
              initialImageUrl={form.image_url}
              onUploadSuccess={(url: string) =>
                dispatchForm({ type: "patch", payload: { image_url: url } })
              }
            />
          </div>

          {error && <p className="text-red-500 text-center text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-[#D6C6AA] text-black py-2 rounded-lg font-semibold hover:bg-[#e5d8c2]"
          >
            {modal.product ? "Salvar Alterações" : "Adicionar"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* Modal Movimento */
function ModalMovimento({
  modal,
  handleMovementSubmit,
  movementQty,
  setMovementQty,
  movementReason,
  setMovementReason,
  error,
  setModal,
}: any) {
  const estoqueAtual = modal.product?.stock ?? 0;
  const tipoEntrada = modal.movementType === "in";
  const novoEstoque =
    estoqueAtual +
    (movementQty ? (tipoEntrada ? parseInt(movementQty, 10) : -parseInt(movementQty, 10)) : 0);

  const handleArrow = (delta: number) => {
    const atual = parseInt(movementQty || "0", 10);
    const novo = Math.max(0, atual + delta);
    setMovementQty(String(novo));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md relative border border-gray-800">
        <button
          onClick={() => setModal({ type: null })}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-[#D6C6AA] mb-4 text-center">
          {tipoEntrada ? "Entrada de Produto" : "Saída de Produto"}
        </h2>

        {/* Estoque Atual */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
          <p className="text-gray-300 text-sm">
            Estoque atual:{" "}
            <span
              className={`font-semibold ${
                estoqueAtual === 0
                  ? "text-red-500"
                  : estoqueAtual <= 5
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              {estoqueAtual}
            </span>
          </p>
          {movementQty && (
            <p className="text-gray-400 text-xs mt-1">
              Novo estoque previsto:{" "}
              <span
                className={`font-semibold ${
                  novoEstoque < 0
                    ? "text-red-600"
                    : tipoEntrada
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}
              >
                {Math.max(novoEstoque, 0)}
              </span>
            </p>
          )}
        </div>

        <form onSubmit={handleMovementSubmit} className="space-y-4">
          {/* Campo de quantidade com setas */}
          <div className="relative">
            <input
              type="number"
              placeholder="Quantidade"
              min="1"
              max={tipoEntrada ? undefined : estoqueAtual}
              value={movementQty}
              onChange={(e) => setMovementQty(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white pr-10"
              required
            />
            <div className="absolute inset-y-0 right-2 flex flex-col justify-center">
              <button
                type="button"
                onClick={() => handleArrow(1)}
                className="text-gray-400 hover:text-white"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => handleArrow(-1)}
                className="text-gray-400 hover:text-white"
                disabled={parseInt(movementQty || "0", 10) <= 0}
              >
                ▼
              </button>
            </div>
          </div>

          <textarea
            placeholder="Motivo (opcional)"
            value={movementReason}
            onChange={(e) => setMovementReason(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />

          {error && <p className="text-red-500 text-center text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-[#D6C6AA] text-black py-2 rounded-lg font-semibold hover:bg-[#e5d8c2]"
          >
            Confirmar
          </button>
        </form>
      </div>
    </div>
  );
}

/* Histórico */
function MovementHistory({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [moves, setMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/estoque?product_id=${productId}`, { cache: "no-store" });
        const json = await res.json();
        setMoves(json.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-900 p-6 rounded-lg w-full max-w-lg relative border border-gray-800">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white">
          <XCircle className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-[#D6C6AA] mb-4 text-center">Histórico de Movimentações</h2>
        {loading ? (
          <p className="text-gray-400 text-center">Carregando...</p>
        ) : moves.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {moves.map((m) => (
              <div key={m.id} className={`bg-gray-800 p-3 rounded-lg border-l-4 ${m.type === "in" ? "border-green-500" : "border-yellow-500"}`}>
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm">
                    {m.type === "in" ? "Entrada" : "Saída"}: <strong>{m.quantity}</strong>
                  </span>
                  <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {m.reason && <p className="text-xs text-gray-400 mt-1">{m.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
