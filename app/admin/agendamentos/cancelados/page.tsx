import AgendaBasePage from "../AgendaBasePage";

export default function CanceladosPage() {
  return (
    <AgendaBasePage
      title="Agendamentos Cancelados"
      statusFilter="cancelled"
    />
  );
}
