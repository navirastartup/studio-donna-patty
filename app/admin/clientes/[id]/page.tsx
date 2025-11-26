import { use } from "react";
import ClientProfileClient from "./ClientProfileClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ClientProfilePage({ params }: PageProps) {
  const { id } = use(params); // ✅ descompacta o Promise de params

  return <ClientProfileClient clientId={id} />;
}
