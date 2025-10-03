"use client";
import { Instagram, Facebook, Youtube } from "lucide-react";

// Imagem correta: mulher com a mão no rosto, editorial, Unsplash (Daniela Mancheva)
const BG_URL = "https://images.unsplash.com/photo-1673945049132-17ff2d9f60c8?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col justify-between overflow-hidden">
      {/* Background image escurecida via Tailwind + filtro para harmonizar */}
      <div
        className="absolute inset-0 -z-10 w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url('${BG_URL}')`, filter: 'grayscale(0.3) contrast(1.1) brightness(0.7) sepia(0.15)' }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Header: Logo e redes sociais */}
      <header className="flex justify-between items-center px-8 pt-8 md:px-16">
        {/* Logo */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-5xl font-serif font-bold text-[#D6C6AA] tracking-tight leading-none">MS</span>
        </div>
        {/* Redes sociais */}
        <nav className="flex gap-4">
          <a href="#" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="text-[#D6C6AA] hover:text-white transition-colors">
            <Instagram className="w-7 h-7" />
          </a>
          <a href="#" aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="text-[#D6C6AA] hover:text-white transition-colors">
            <Facebook className="w-7 h-7" />
          </a>
          <a href="#" aria-label="Youtube" target="_blank" rel="noopener noreferrer" className="text-[#D6C6AA] hover:text-white transition-colors">
            <Youtube className="w-7 h-7" />
          </a>
        </nav>
      </header>

      {/* Conteúdo principal */}
      <section className="flex-1 flex flex-col justify-center items-start px-8 md:px-16 max-w-2xl gap-8">
        <span className="uppercase text-xs tracking-widest text-[#D6C6AA] font-medium">Patty Ribeiro - Manicure & Pedicure</span>
        <h1 className="text-5xl md:text-6xl font-serif font-bold text-[#D6C6AA] leading-tight drop-shadow-lg">
          BELEZA <span className="italic font-normal">com</span><br />IDENTIDADE
        </h1>
        <p className="text-base md:text-lg text-white/90 max-w-lg">
          Seu cuidado com a sua beleza é o nosso maior compromisso. <br />
          Agende seu horário agora mesmo.
        </p>
        <a href="/agendamento" className="inline-block bg-[#D6C6AA] text-black font-semibold rounded-md px-8 py-3 mt-2 shadow-lg hover:bg-[#e5d8c2] transition-colors text-base animate-bounce">AGENDAR</a>
      </section>
    </main>
  );
}
