export interface PaymentRow {
  id: string;
  clientName: string;
  clientImage?: string | null;

  professionalName?: string | null;
  professionalImage?: string | null;

  serviceName?: string | null;

  method: string | null;
  amount: number;
  status: string;

  dateISO: string;
  origin: "appointment" | "manual";
}
