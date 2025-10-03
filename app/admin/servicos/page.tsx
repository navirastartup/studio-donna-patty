"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PlusCircle, Edit, Trash2, XCircle } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload"; // Importar o novo componente

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string | null; // Pode ser null agora
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
    // Remover image_url do estado do formulário diretamente aqui
  });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // Estado para a URL da imagem atual

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    const { data, error } = await supabase.from('services').select('*');
    if (error) {
      console.error("Erro ao buscar serviços:", error);
      setError(error.message);
    } else {
      setServices(data);
    }
    setLoading(false);
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setEditingService(null);
    setForm({ name: "", description: "", price: "" }); // Remover image_url daqui
    setCurrentImageUrl(null); // Limpar a URL da imagem atual
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setForm({ name: service.name, description: service.description || "", price: service.price.toString() });
    setCurrentImageUrl(service.image_url || null); // Definir a URL da imagem atual
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setForm({ name: "", description: "", price: "" }); // Remover image_url daqui
    setCurrentImageUrl(null); // Limpar a URL da imagem atual
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const serviceData = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      image_url: currentImageUrl, // Usar a URL do estado currentImageUrl
    };

    if (editingService) {
      // Lógica para editar serviço no Supabase
      const { error } = await supabase
        .from('services')
        .update(serviceData)
        .eq('id', editingService.id);
      if (error) {
        console.error("Erro ao atualizar serviço:", error);
        setError(error.message);
      } else {
        closeModal();
        fetchServices();
      }
    } else {
      // Lógica para adicionar novo serviço no Supabase
      const { error } = await supabase.from('services').insert([serviceData]);
      if (error) {
        console.error("Erro ao adicionar serviço:", error);
        setError(error.message);
      } else {
        closeModal();
        fetchServices();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este serviço?")) {
      setError(null);
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) {
        console.error("Erro ao deletar serviço:", error);
        setError(error.message);
      } else {
        fetchServices();
      }
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando serviços...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">Gerenciar Serviços</h2>
        <button
          onClick={openAddModal}
          className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#e5d8c2] transition-colors"
        >
          <PlusCircle className="w-5 h-5" /> Adicionar Serviço
        </button>
      </div>

      {services.length === 0 ? (
        <p className="text-gray-400">Nenhum serviço cadastrado ainda. Adicione um novo serviço!</p>
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
                <p className="text-gray-400 text-sm mb-3">{service.description}</p>
                <p className="text-[#D6C6AA] font-bold text-lg mb-4">R$ {service.price.toFixed(2).replace('.', ',')}</p>
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

      {/* Modal de Adicionar/Editar Serviço */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-8 w-full max-w-md shadow-lg relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">
              {editingService ? "Editar Serviço" : "Adicionar Novo Serviço"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Nome do Serviço</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
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
                  onChange={handleFormChange}
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
                  onChange={handleFormChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>
              <div>
                <label htmlFor="image_url" className="block text-sm font-medium text-gray-300 mb-2">Imagem do Serviço</label>
                <ImageUpload
                  initialImageUrl={currentImageUrl}
                  onUploadSuccess={url => setCurrentImageUrl(url)}
                  onRemove={() => setCurrentImageUrl(null)}
                  bucketName="images" // O nome do seu bucket no Supabase Storage
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
