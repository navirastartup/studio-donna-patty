"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PlusCircle, Edit, Trash2, XCircle, DollarSign, Receipt, CreditCard } from "lucide-react";

interface Client {
  id: string;
  full_name: string;
}

interface Invoice {
  id: string;
  client_id: string;
  clients: Client; // Para JOIN com a tabela clients
  amount: number;
  status: string;
  issue_date: string;
  due_date?: string | null;
  notes?: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method?: string | null;
  created_at: string;
}

export default function AdminFaturamentoPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]); // Para seleção de cliente no form
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    client_id: "",
    amount: "",
    status: "pending",
    due_date: "",
    notes: "",
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceIdForPayment, setSelectedInvoiceIdForPayment] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch Invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*, clients(full_name)') // JOIN com clients para exibir o nome
        .order('issue_date', { ascending: false });
      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData as Invoice[]);

      // Fetch Payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
      if (paymentsError) throw paymentsError;
      setPayments(paymentsData as Payment[]);

      // Fetch Clients for invoice form
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, full_name');
      if (clientsError) throw clientsError;
      setClients(clientsData as Client[]);

    } catch (err: any) {
      console.error("Erro ao carregar dados de faturamento:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Lógica para Faturas
  const handleInvoiceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setInvoiceForm({ ...invoiceForm, [e.target.name]: e.target.value });
  };

  const openAddInvoiceModal = () => {
    setEditingInvoice(null);
    setInvoiceForm({ client_id: "", amount: "", status: "pending", due_date: "", notes: "" });
    setIsInvoiceModalOpen(true);
  };

  const openEditInvoiceModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceForm({
      client_id: invoice.client_id,
      amount: invoice.amount.toString(),
      status: invoice.status,
      due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : "",
      notes: invoice.notes || "",
    });
    setIsInvoiceModalOpen(true);
  };

  const closeInvoiceModal = () => {
    setIsInvoiceModalOpen(false);
    setEditingInvoice(null);
    setInvoiceForm({ client_id: "", amount: "", status: "pending", due_date: "", notes: "" });
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const invoiceData = {
      client_id: invoiceForm.client_id,
      amount: parseFloat(invoiceForm.amount),
      status: invoiceForm.status,
      issue_date: new Date().toISOString(),
      due_date: invoiceForm.due_date ? new Date(invoiceForm.due_date).toISOString() : null,
      notes: invoiceForm.notes || null,
    };

    if (editingInvoice) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update(invoiceData)
        .eq('id', editingInvoice.id);
      if (updateError) {
        console.error("Erro ao atualizar fatura:", updateError);
        setError(updateError.message);
      } else {
        closeInvoiceModal();
        fetchData();
      }
    } else {
      const { error: insertError } = await supabase.from('invoices').insert([invoiceData]);
      if (insertError) {
        console.error("Erro ao adicionar fatura:", insertError);
        setError(insertError.message);
      } else {
        closeInvoiceModal();
        fetchData();
      }
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar esta fatura? Isso também removerá os pagamentos associados.")) {
      setError(null);
      const { error: deleteError } = await supabase.from('invoices').delete().eq('id', id);
      if (deleteError) {
        console.error("Erro ao deletar fatura:", deleteError);
        setError(deleteError.message);
      } else {
        fetchData();
      }
    }
  };

  // Lógica para Pagamentos
  const handlePaymentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPaymentForm({ ...paymentForm, [e.target.name]: e.target.value });
  };

  const openAddPaymentModal = (invoiceId: string) => {
    setSelectedInvoiceIdForPayment(invoiceId);
    setPaymentForm({ amount: "", method: "" });
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedInvoiceIdForPayment(null);
    setPaymentForm({ amount: "", method: "" });
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedInvoiceIdForPayment || !paymentForm.amount || !paymentForm.method) {
      setError("Fatura, valor e método de pagamento são obrigatórios.");
      return;
    }

    const paymentData = {
      invoice_id: selectedInvoiceIdForPayment,
      amount: parseFloat(paymentForm.amount),
      method: paymentForm.method,
      payment_date: new Date().toISOString(),
    };

    try {
      const { error: insertPaymentError } = await supabase.from('payments').insert([paymentData]);
      if (insertPaymentError) {
        throw insertPaymentError;
      }
      // Opcional: Atualizar o status da fatura para 'paid' se o valor pago for igual ou maior ao total da fatura
      const invoice = invoices.find(inv => inv.id === selectedInvoiceIdForPayment);
      if (invoice && parseFloat(paymentForm.amount) >= invoice.amount && invoice.status !== 'paid') {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', selectedInvoiceIdForPayment);
      }

      closePaymentModal();
      fetchData(); // Refetch para atualizar tudo
    } catch (err: any) {
      console.error("Erro ao registrar pagamento:", err);
      setError(err.message);
    }
  };

  if (loading) return <p className="text-[#D6C6AA]">Carregando dados de faturamento...</p>;
  if (error) return <p className="text-red-500">Erro: {error}</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-[#D6C6AA]">Gerenciar Faturamento</h2>
        <button
          onClick={openAddInvoiceModal}
          className="bg-[#D6C6AA] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#e5d8c2] transition-colors"
        >
          <PlusCircle className="w-5 h-5" /> Adicionar Fatura
        </button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-gray-400">Nenhuma fatura cadastrada ainda. Adicione uma nova fatura!</p>
      ) : (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md mb-8">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Emissão</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{invoice.clients?.full_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">R$ {invoice.amount.toFixed(2).replace('.', ',')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(invoice.issue_date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditInvoiceModal(invoice)}
                        className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" /> Editar
                      </button>
                      <button
                        onClick={() => openAddPaymentModal(invoice.id)}
                        className="text-green-500 hover:text-green-700 flex items-center gap-1"
                      >
                        <CreditCard className="w-4 h-4" /> Pagamento
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="text-2xl font-bold text-[#D6C6AA] mt-12 mb-6">Pagamentos Recentes</h3>
      {payments.length === 0 ? (
        <p className="text-gray-400">Nenhum pagamento registrado ainda.</p>
      ) : (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fatura ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Valor Pago</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Método</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{payment.invoice_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">R$ {payment.amount.toFixed(2).replace('.', ',')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{payment.method || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(payment.payment_date).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Adicionar/Editar Fatura */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-8 w-full max-w-md shadow-lg relative">
            <button onClick={closeInvoiceModal} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">
              {editingInvoice ? "Editar Fatura" : "Adicionar Nova Fatura"}
            </h3>
            <form onSubmit={handleSubmitInvoice} className="space-y-4">
              <div>
                <label htmlFor="client_id" className="block text-sm font-medium text-gray-300 mb-2">Cliente</label>
                <select
                  id="client_id"
                  name="client_id"
                  value={invoiceForm.client_id}
                  onChange={handleInvoiceFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#D6C6AA]"
                  required
                >
                  <option value="" disabled>Selecione um cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">Valor (R$)</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={invoiceForm.amount}
                  onChange={handleInvoiceFormChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  id="status"
                  name="status"
                  value={invoiceForm.status}
                  onChange={handleInvoiceFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#D6C6AA]"
                  required
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-300 mb-2">Data de Vencimento</label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={invoiceForm.due_date}
                  onChange={handleInvoiceFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                />
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">Notas (Opcional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={invoiceForm.notes}
                  onChange={handleInvoiceFormChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                ></textarea>
              </div>
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#D6C6AA] text-black px-5 py-2 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors"
                >
                  {editingInvoice ? "Salvar Alterações" : "Adicionar Fatura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-8 w-full max-w-md shadow-lg relative">
            <button onClick={closePaymentModal} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-[#D6C6AA] mb-6 text-center">Registrar Pagamento</h3>
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label htmlFor="payment_amount" className="block text-sm font-medium text-gray-300 mb-2">Valor do Pagamento (R$)</label>
                <input
                  type="number"
                  id="payment_amount"
                  name="amount"
                  value={paymentForm.amount}
                  onChange={handlePaymentFormChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D6C6AA]"
                  required
                />
              </div>
              <div>
                <label htmlFor="payment_method" className="block text-sm font-medium text-gray-300 mb-2">Método de Pagamento</label>
                <select
                  id="payment_method"
                  name="method"
                  value={paymentForm.method}
                  onChange={handlePaymentFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#D6C6AA]"
                  required
                >
                  <option value="" disabled>Selecione um método</option>
                  <option value="Pix">Pix</option>
                  <option value="Credit Card">Cartão de Crédito</option>
                  <option value="Cash">Dinheiro</option>
                  <option value="Bank Transfer">Transferência Bancária</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#D6C6AA] text-black px-5 py-2 rounded-lg font-semibold hover:bg-[#e5d8c2] transition-colors"
                >
                  Registrar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
