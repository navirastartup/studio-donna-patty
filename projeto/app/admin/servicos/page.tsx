"use client";
import { useState, useEffect } from "react";
import { PlusCircle, Edit, Trash2, XCircle, Clock } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes?: number;
  image_url?: string | null;
}

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
  });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  // 🔄 Buscar serviços
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

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setEditingService(null);
    setForm({ name: "", description: "", price: "", duration_minutes: "60" });
    setCurrentImageUrl(null);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      duration_minutes: service.duration_minutes?.toString() || "60",
    });
    setCurrentImageUrl(service.image_url || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setForm({ name: "", description: "", price: "", duration_minutes: "60" });
    setCurrentImageUrl(null);
  };

  // 💾 Criar ou atualizar serviço
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const serviceData = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      duration_minutes: parseInt(form.duration_minutes, 10),
      image_url: currentImageUrl,
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

  // 🗑️ Deletar serviço
  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este serviço?")) {
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
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando serviços...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">Gerenciar Serviços</h2>
        <button
          onClick={openAddModal}
          className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#e5d8c2] transition-colors"
        >
          <PlusCircle className="w-5 h-5" /> Adicionar Serviço
        </button>
      </div>

      {/* Listagem */}
      {services.length === 0 ? (
        <p className="text-gray-400">Nenhum serviço cadastrado ainda. Adicione um novo!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <img
                src={service.image_url || "https://via.placeholder.com/400x250/333/d6c6aa?text=Serviço"}
                alt={service.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold text-white mb-2">{service.name}</h3>
                <p className="text-gray-400 text-sm mb-2">{service.description}</p>
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                  <Clock className="w-4 h-4 text-[#D6C6AA]" />
                  <span>{service.duration_minutes || 60} min</span>
                </div>
                <p className="text-[#D6C6AA] font-bold text-lg mb-4">
                  R$ {service.price.toFixed(2).replace(".", ",")}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(service)}
                    className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-8 w-full max-w-md shadow-lg relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">
              {editingService ? "Editar Serviço" : "Adicionar Novo Serviço"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Nome do Serviço
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#D6C6AA]"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#D6C6AA]"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={form.price}
                    onChange={handleFormChange}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#D6C6AA]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-300 mb-2">
                    Duração (min)
                  </label>
                  <input
                    type="number"
                    id="duration_minutes"
                    name="duration_minutes"
                    value={form.duration_minutes}
                    onChange={handleFormChange}
                    min="10"
                    step="5"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#D6C6AA]"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="image_url" className="block text-sm font-medium text-gray-300 mb-2">
                  Imagem do Serviço
                </label>
                <ImageUpload
                  initialImageUrl={currentImageUrl}
                  onUploadSuccess={(url) => setCurrentImageUrl(url)}
                  onRemove={() => setCurrentImageUrl(null)}
                  bucketName="images"
                />
              </div>

              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#D6C6AA] text-black px-5 py-2 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors"
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
