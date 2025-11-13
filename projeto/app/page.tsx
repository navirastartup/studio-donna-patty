"use client";
import Image from "next/image";
import Link from "next/link";
import imgHero from "@/public/patty-hero-4.jpg";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-[#141414] overflow-hidden flex items-center">
      
      {/* BACKGROUND */}
      <Image
  src={imgHero}
  alt="Patrícia Ribeiro"
  fill
  priority
  className="hero-img object-cover brightness-[1.12] contrast-[1.05] saturate-[1.08]"
/>


      {/* DEGRADÊ SUAVE E LUXUOSO */}
<div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/80 to-[#141414]/10" />


      {/* CONTEÚDO */}
      <div className="relative z-10 pl-[8vw] max-w-[42rem] py-24">
        
        <h1 className="font-serif text-[#E8DCC3] text-[4rem] leading-tight font-bold tracking-tight">
          BELEZA <span className="italic font-normal">com</span><br />
          IDENTIDADE
        </h1>

        <p className="text-[#f3f3f3]/90 text-lg mt-6 leading-relaxed max-w-[32rem]">
          Eu sou <span className="font-semibold">Patrícia Ribeiro</span>, e ofereço um atendimento
          pensado para valorizar a sua autenticidade e realçar aquilo que é só seu.
        </p>

        {/* BOTÃO - O FOCO */}
        <Link
          href="/agendamento"
          className="mt-10 inline-flex items-center justify-center px-10 py-4 rounded-full
          bg-[#E8DCC3] text-[#1a1a1a] font-semibold tracking-wide text-lg
          shadow-[0_0_30px_rgba(232,220,195,0.55)]
          hover:shadow-[0_0_45px_rgba(232,220,195,0.85)]
          hover:bg-[#f4ead7] transition-all duration-200"
        >
          AGENDAR AGORA
        </Link>

        <div className="mt-14 text-sm text-white/40">
          Desenvolvido por <span className="text-[#ff4d00] font-semibold">Navira</span>
        </div>
      </div>
    </main>
  );
}
