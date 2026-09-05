import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baja & Aguiar | Central de Performance",
  description: "Central interna de acompanhamento de painéis, clientes e integrações.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
