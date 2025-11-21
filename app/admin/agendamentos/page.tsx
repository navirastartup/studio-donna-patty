"use client";

import AgendaBasePage from "./AgendaBasePage";

export default function AgendamentosAtivos() {
  return (
    <AgendaBasePage
      title="Agendamentos Ativos"
      statusFilter="active"
    />
  );
}
