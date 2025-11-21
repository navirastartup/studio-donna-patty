import AgendaBasePage from "../AgendaBasePage";

export default function ConcluidosPage() {
  return (
    <AgendaBasePage
      title="Agendamentos Concluídos"
      statusFilter="completed"
    />
  );
}
