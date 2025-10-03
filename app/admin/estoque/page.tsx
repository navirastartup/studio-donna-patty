"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PlusCircle, Edit, Trash2, XCircle, Package, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string | null;
}

interface StockMovement {
  id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  reason?: string;
  created_at: string;
}

export default function AdminEstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
  });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const [selectedProductIdForMovement, setSelectedProductIdForMovement] = useState<string | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: 'in',
    quantity: "",
    reason: "",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('products').select('*').order('name');
    if (fetchError) {
      console.error("Erro ao buscar produtos:", fetchError);
      setError(fetchError.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  const handleProductFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", stock: "" });
    setCurrentImageUrl(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setForm({ ...product, price: product.price.toString(), stock: product.stock.toString() });
    setCurrentImageUrl(product.image_url || null);
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", stock: "" });
    setCurrentImageUrl(null);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const productData = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      image_url: currentImageUrl,
    };

    if (editingProduct) {
      const { error: updateError } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);
      if (updateError) {
        console.error("Erro ao atualizar produto:", updateError);
        setError(updateError.message);
      } else {
        closeProductModal();
        fetchProducts();
      }
    } else {
      const { error: insertError } = await supabase.from('products').insert([productData]);
      if (insertError) {
        console.error("Erro ao adicionar produto:", insertError);
        setError(insertError.message);
      } else {
        closeProductModal();
        fetchProducts();
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este produto? Isso também removerá os movimentos de estoque associados.")) {
      setError(null);
      const { error: deleteError } = await supabase.from('products').delete().eq('id', id);
      if (deleteError) {
        console.error("Erro ao deletar produto:", deleteError);
        setError(deleteError.message);
      } else {
        fetchProducts();
      }
    }
  };

  // Lógica para movimentos de estoque
  const openMovementModal = (productId: string, type: 'in' | 'out') => {
    setSelectedProductIdForMovement(productId);
    setMovementForm({ type, quantity: "", reason: "" });
    setIsMovementModalOpen(true);
  };

  const closeMovementModal = () => {
    setIsMovementModalOpen(false);
    setSelectedProductIdForMovement(null);
    setMovementForm({ type: 'in', quantity: "", reason: "" });
  };

  const handleMovementFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setMovementForm({ ...movementForm, [e.target.name]: e.target.value });
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductIdForMovement || !movementForm.quantity) {
      setError("Produto e quantidade são obrigatórios.");
      return;
    }

    const movementData = {
      product_id: selectedProductIdForMovement,
      type: movementForm.type,
      quantity: parseInt(movementForm.quantity),
      reason: movementForm.reason || null,
    };

    try {
      const { error: insertMovementError } = await supabase.from('stock_movements').insert([movementData]);
      if (insertMovementError) {
        throw insertMovementError;
      }
      closeMovementModal();
      fetchProducts(); // Refetch para atualizar o estoque
    } catch (err: any) {
      console.error("Erro ao registrar movimento de estoque:", err);
      setError(err.message);
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando estoque...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">Controle de Estoque</h2>
        <button
          onClick={openAddProductModal}
          className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#e5d8c2] transition-colors"
        >
          <PlusCircle className="w-5 h-5" /> Adicionar Produto
        </button>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-400">Nenhum produto cadastrado ainda. Adicione um novo produto!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <img
                src={product.image_url || "https://via.placeholder.com/400x250/333/d6c6aa?text=Produto"}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold text-white mb-2">{product.name}</h3>
                <p className="text-gray-400 text-sm mb-3">{product.description}</p>
                <p className="text-[#D6C6AA] font-bold text-lg mb-2">R$ {product.price.toFixed(2).replace('.', ',')}</p>
                <p className={`text-sm font-medium ${product.stock > 0 ? "text-green-500" : "text-red-500"}`}>Estoque: {product.stock}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => openEditProductModal(product)}
                    className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={() => openMovementModal(product.id, 'in')}
                    className="bg-green-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 hover:bg-green-700 transition-colors"
                  >
                    <ArrowUpCircle className="w-4 h-4" /> Entrada
                  </button>
                  <button
                    onClick={() => openMovementModal(product.id, 'out')}
                    className="bg-yellow-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 hover:bg-yellow-700 transition-colors"
                  >
                    <ArrowDownCircle className="w-4 h-4" /> Saída
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Deletar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Adicionar/Editar Produto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-8 w-full max-w-md shadow-lg relative">
            <button onClick={closeProductModal} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">
              {editingProduct ? "Editar Produto" : "Adicionar Novo Produto"}
            </h3>
            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Nome do Produto</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleProductFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleProductFormChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                ></textarea>
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-2">Preço (R$)</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={form.price}
                  onChange={handleProductFormChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>
              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-gray-300 mb-2">Estoque Inicial</label>
                <input
                  type="number"
                  id="stock"
                  name="stock"
                  value={form.stock}
                  onChange={handleProductFormChange}
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                  disabled={!!editingProduct} // Desabilita edição de estoque inicial em modo edição
                />
                {editingProduct && <p className="text-gray-500 text-xs mt-1">Para ajustar o estoque, use os botões de Entrada/Saída na listagem.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Imagem do Produto</label>
                <ImageUpload
                  initialImageUrl={currentImageUrl}
                  onUploadSuccess={url => setCurrentImageUrl(url)}
                  onRemove={() => setCurrentImageUrl(null)}
                  bucketName="images"
                />
              </div>
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#D6C6AA] text-black px-5 py-2 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors"
                >
                  {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Movimento de Estoque */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-8 w-full max-w-md shadow-lg relative">
            <button onClick={closeMovementModal} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">
              {movementForm.type === 'in' ? "Registrar Entrada de Estoque" : "Registrar Saída de Estoque"}
            </h3>
            <form onSubmit={handleSubmitMovement} className="space-y-4">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-300 mb-2">Quantidade</label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={movementForm.quantity}
                  onChange={handleMovementFormChange}
                  min="1"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">Razão (Opcional)</label>
                <textarea
                  id="reason"
                  name="reason"
                  value={movementForm.reason}
                  onChange={handleMovementFormChange}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                ></textarea>
              </div>
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeMovementModal}
                  className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#D6C6AA] text-black px-5 py-2 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors"
                >
                  Registrar Movimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
