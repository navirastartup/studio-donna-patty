"use client";
import { useState, useEffect } from "react";
import { PlusCircle, Edit, Trash2, XCircle } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

interface Professional {
  id: string;
  name: string;
  specialty?: string;
  image_url?: string | null;
  bio?: string;
}

export default function AdminProfissionaisPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [form, setForm] = useState({
    name: "",
    specialty: "",
    bio: "",
  });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchProfessionals();
  }, []);

  // ✅ Buscar lista de profissionais
  async function fetchProfessionals() {
    setLoading(true);
    try {
      const res = await fetch("/api/professionals", { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfessionals(data.data || []);
    } catch (err: any) {
      console.error("Erro ao buscar profissionais:", err);
      setError(err.message);
    }
    setLoading(false);
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setEditingProfessional(null);
    setForm({ name: "", specialty: "", bio: "" });
    setCurrentImageUrl(null);
    setIsModalOpen(true);
  };

  const openEditModal = (professional: Professional) => {
    setEditingProfessional(professional);
    setForm({
      name: professional.name,
      specialty: professional.specialty || "",
      bio: professional.bio || "",
    });
    setCurrentImageUrl(professional.image_url || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfessional(null);
    setForm({ name: "", specialty: "", bio: "" });
    setCurrentImageUrl(null);
  };

  // ✅ Salvar (criar/editar) profissional
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const professionalData = {
      name: form.name,
      specialty: form.specialty,
      image_url: currentImageUrl,
      bio: form.bio,
    };

    try {
      const res = await fetch("/api/professionals", {
        method: editingProfessional ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingProfessional
            ? { id: editingProfessional.id, ...professionalData }
            : professionalData
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");

      closeModal();
      fetchProfessionals();
    } catch (err: any) {
      console.error("Erro ao salvar profissional:", err);
      alert(`Erro ao salvar profissional: ${err.message}`);
    }
  };

  // ✅ Deletar profissional
  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este profissional?")) {
      try {
        const res = await fetch("/api/professionals", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao deletar");
        fetchProfessionals();
      } catch (err: any) {
        console.error("Erro ao deletar profissional:", err);
        alert(`Erro ao deletar: ${err.message}`);
      }
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando profissionais...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">Gerenciar Profissionais</h2>
        <button
          onClick={openAddModal}
          className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#e5d8c2] transition-colors"
        >
          <PlusCircle className="w-5 h-5" /> Adicionar Profissional
        </button>
      </div>

      {professionals.length === 0 ? (
        <p className="text-gray-400">Nenhum profissional cadastrado ainda. Adicione um novo profissional!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {professionals.map((professional) => (
            <div key={professional.id} className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <img
                src={professional.image_url || "https://via.placeholder.com/400x250/333/d6c6aa?text=Profissional"}
                alt={professional.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold text-white mb-2">{professional.name}</h3>
                <p className="text-gray-400 text-sm mb-3">{professional.specialty}</p>
                {professional.bio && <p className="text-gray-500 text-xs mb-3 truncate">{professional.bio}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(professional)}
                    className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(professional.id)}
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
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">
              {editingProfessional ? "Editar Profissional" : "Adicionar Novo Profissional"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Nome do Profissional</label>
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
                <label htmlFor="specialty" className="block text-sm font-medium text-gray-300 mb-2">Especialidade</label>
                <input
                  type="text"
                  id="specialty"
                  name="specialty"
                  value={form.specialty}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  placeholder="Manicure, Nail Artist, etc."
                />
              </div>
              <div>
                <label htmlFor="image_url" className="block text-sm font-medium text-gray-300 mb-2">Foto do Profissional</label>
                <ImageUpload
                  initialImageUrl={currentImageUrl}
                  onUploadSuccess={url => setCurrentImageUrl(url)}
                  onRemove={() => setCurrentImageUrl(null)}
                  bucketName="images"
                />
              </div>
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-2">Biografia (Opcional)</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={form.bio}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                ></textarea>
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
                  {editingProfessional ? "Salvar Alterações" : "Adicionar Profissional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
