"use client";

import { useState, useEffect, useMemo } from "react";
import {
  PlusCircle,
  Edit,
  Trash2,
  XCircle,
  Clock,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;                // preço base (sem desconto)
  duration_minutes?: number;
  image_url?: string | null;
  discount_percent?: number | null; // novo campo
}

type SortBy = "name" | "duration" | "price";
type SortDir = "asc" | "desc";

const formatCurrency = (value: number) =>
  value.toFixed(2).replace(".", ",");

const applyDiscount = (price: number, discount?: number | null) => {
  if (!discount || discount <= 0) return price;
  const final = price * (1 - discount / 100);
  return Math.round(final * 100) / 100;
};

export default function AdminServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    duration_minutes: "60",
    discount_percent: "",
  });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // filtros/ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    fetchServices();
  }, []);

  // Buscar serviços
  async function fetchServices() {
    setLoading(true);
    try {
      const res = await fetch("/api/service", { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setServices(data.data || []);
    } catch (err: any) {
      console.error("Erro ao buscar serviços:", err);
      setError(err.message);
    }
    setLoading(false);
  }

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      price: "",
      duration_minutes: "60",
      discount_percent: "",
    });
    setCurrentImageUrl(null);
    setEditingService(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      duration_minutes: service.duration_minutes?.toString() || "60",
      discount_percent:
        service.discount_percent != null
          ? service.discount_percent.toString()
          : "",
    });
    setCurrentImageUrl(service.image_url || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setError(null);
  };

  // Criar ou atualizar serviço
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const discountRaw = form.discount_percent.trim();
    const discountParsed = discountRaw === "" ? null : Number(discountRaw);

    const serviceData = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      duration_minutes: parseInt(form.duration_minutes, 10),
      image_url: currentImageUrl,
      discount_percent:
        discountParsed != null && !Number.isNaN(discountParsed)
          ? discountParsed
          : null,
    };

    try {
      const res = await fetch("/api/service", {
        method: editingService ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingService ? { id: editingService.id, ...serviceData } : serviceData
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");

      closeModal();
      fetchServices();
    } catch (err: any) {
      console.error("Erro ao salvar serviço:", err);
      alert(`Erro ao salvar serviço: ${err.message}`);
    }
  };

  // Deletar serviço
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este serviço?")) return;

    try {
      const res = await fetch("/api/service", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao deletar");
      fetchServices();
    } catch (err: any) {
      console.error("Erro ao deletar serviço:", err);
      alert(`Erro ao deletar: ${err.message}`);
    }
  };

  // Lista filtrada + ordenada
  const filteredAndSortedServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = [...services];

    if (term) {
      list = list.filter((s) => {
        const name = s.name?.toLowerCase() ?? "";
        const desc = s.description?.toLowerCase() ?? "";
        return name.includes(term) || desc.includes(term);
      });
    }

    list.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      if (sortBy === "name") {
        aVal = a.name || "";
        bVal = b.name || "";
        const cmp = String(aVal).localeCompare(String(bVal), "pt-BR", {
          sensitivity: "base",
        });
        return sortDir === "asc" ? cmp : -cmp;
      }

      if (sortBy === "duration") {
        aVal = a.duration_minutes ?? 0;
        bVal = b.duration_minutes ?? 0;
      } else if (sortBy === "price") {
        aVal = a.price ?? 0;
        bVal = b.price ?? 0;
      }

      const diff = Number(aVal) - Number(bVal);
      return sortDir === "asc" ? diff : -diff;
    });

    return list;
  }, [services, searchTerm, sortBy, sortDir]);

  if (loading) return <p className="text-[#D6C6AA]">Carregando serviços...</p>;
  if (error && !isModalOpen) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#D6C6AA]">
            Gerenciar Serviços
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Cadastre, organize e edite os serviços do Studio.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#e5d8c2] transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Adicionar Serviço
        </button>
      </div>

      {/* Filtros: busca + ordenação */}
      {services.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Busca */}
          <div className="relative w-full md:max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou descrição"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D6C6AA]"
            />
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-3 justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                Ordenar por
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="bg-gray-900 border border-gray-700 text-sm text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D6C6AA]"
              >
                <option value="name">Nome</option>
                <option value="duration">Duração</option>
                <option value="price">Preço</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-100 hover:bg-gray-800 transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>{sortDir === "asc" ? "Asc" : "Desc"}</span>
            </button>
          </div>
        </div>
      )}

{/* LISTAGEM */}
{services.length === 0 ? (
  <p className="text-gray-400">Nenhum serviço cadastrado ainda.</p>
) : (
  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">

    {/* Cabeçalho */}
    <div className="
      grid grid-cols-[2fr,1fr,1fr,1fr,1fr]
      px-6 py-3 bg-gray-800
      text-gray-400 text-sm font-semibold
    ">
      <span>Serviço</span>
      <span className="flex items-center justify-center gap-1">
        <Clock className="w-4 h-4 text-gray-400" />  
        Duração
      </span>
      <span className="text-center">Preço</span>
      <span className="text-center">Imagem</span>
      <span className="text-right">Ações</span>
    </div>

    {/* Linhas */}
    {filteredAndSortedServices.map((service) => {
      const hasDiscount = service.discount_percent && service.discount_percent > 0;
      const finalPrice = applyDiscount(service.price, service.discount_percent);

      return (
        <div
          key={service.id}
          className="
            grid grid-cols-[2fr,1fr,1fr,1fr,1fr]
            items-center gap-4
            px-6 py-4
            border-t border-gray-800
            hover:bg-gray-800/40 transition
          "
        >
          {/* Nome + Descrição */}
          <div className="flex flex-col">
            <span className="text-white font-semibold">{service.name}</span>
            {service.description && (
              <span className="text-gray-500 text-sm truncate max-w-[260px]">
                {service.description}
              </span>
            )}
          </div>

          {/* Duração */}
          <div className="text-center text-gray-300">
            {service.duration_minutes ?? 60} min
          </div>

          {/* Preço + desconto */}
          <div className="text-center">
            <span className="text-[#D6C6AA] font-bold block">
              R$ {formatCurrency(finalPrice)}
            </span>

            {hasDiscount && (
              <span className="text-xs text-red-400 font-medium block">
                De R$ {formatCurrency(service.price)} • {service.discount_percent}% OFF
              </span>
            )}
          </div>

          {/* Imagem */}
          <div className="flex justify-center">
            <img
              src={
                service.image_url ||
                "https://via.placeholder.com/80/333/d6c6aa?text=IMG"
              }
              className="w-14 h-14 rounded-lg object-cover border border-gray-700 shadow"
              alt={service.name}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => openEditModal(service)}
              className="px-3 py-1 rounded-md bg-blue-600 text-sm text-white hover:bg-blue-700 transition flex items-center gap-1"
            >
              <Edit className="w-4 h-4" /> Editar
            </button>

            <button
              onClick={() => handleDelete(service.id)}
              className="px-3 py-1 rounded-md bg-red-600 text-sm text-white hover:bg-red-700 transition flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> Deletar
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl backdrop-saturate-200 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div
            className="
              backdrop-blur-2xl backdrop-saturate-150 
              bg-white/10 
              border border-white/20 
              shadow-[0_8px_32px_rgba(0,0,0,0.25)]
              rounded-3xl w-full max-w-md
              animate-zoomIn
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-[#D6C6AA]">
                {editingService ? "Editar Serviço" : "Adicionar Serviço"}
              </h3>

              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Conteúdo (scroll) */}
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 overflow-y-auto space-y-5 max-h-[70vh]">
                {/* Nome */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Nome do Serviço
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#D6C6AA] focus:outline-none"
                    required
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Descrição
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#D6C6AA] focus:outline-none"
                  ></textarea>
                </div>

                {/* Preço + Duração + Desconto */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm text-gray-300 mb-1">
                      Preço (R$)
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={form.price}
                      onChange={handleFormChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#D6C6AA] focus:outline-none"
                      required
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm text-gray-300 mb-1">
                      Desconto (%)
                    </label>
                    <input
                      type="number"
                      name="discount_percent"
                      value={form.discount_percent}
                      onChange={handleFormChange}
                      min="0"
                      max="100"
                      step="1"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#D6C6AA] focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm text-gray-300 mb-1">
                      Duração (min)
                    </label>
                    <input
                      type="number"
                      name="duration_minutes"
                      value={form.duration_minutes}
                      onChange={handleFormChange}
                      min="10"
                      step="5"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#D6C6AA] focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Imagem */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Imagem do Serviço
                  </label>

                  <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
                    <ImageUpload
                      initialImageUrl={currentImageUrl}
                      onUploadSuccess={(url) => setCurrentImageUrl(url)}
                      onRemove={() => setCurrentImageUrl(null)}
                      bucketName="images"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-900 rounded-b-3xl">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#D6C6AA] text-black font-semibold hover:bg-[#e8dcc1] transition"
                >
                  {editingService ? "Salvar Alterações" : "Adicionar Serviço"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
