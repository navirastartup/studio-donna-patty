export interface RowUI {
  id: string;

  clientName: string;
  clientImage?: string | null;

  professionalName: string | null;
  professionalImage?: string | null;

  serviceName: string | null;

  method: string | null;
  amount: number;

  status: string; // sempre string, sem null
  dateISO: string;

  origin: "appointment" | "manual";

  appointmentStart?: string | null;
  appointmentEnd?: string | null;
}
