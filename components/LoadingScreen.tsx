export default function LoadingScreen() {
  return (
    <div
      className="w-full h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#E8DCC3]"
      style={{
        backgroundImage: `linear-gradient(to bottom, #0D0D0D, #000000)`,
      }}
    >
      {/* ANIMAÇÃO APPLE - spinner minimalista */}
      <div className="relative w-14 h-14 flex items-center justify-center animate-fadeInSlow">
        {/* trilho suave */}
        <div className="absolute inset-0 rounded-full border-[3px] border-[#E8DCC3]/10" />

        {/* linha que gira */}
        <div className="absolute inset-0 rounded-full border-[3px] border-t-[#E8DCC3] animate-appleSpin" />
      </div>

      {/* TEXTO APPLE STYLE */}
      <p className="mt-6 text-sm tracking-wide opacity-70 animate-appleFadeText">
        Carregando...
      </p>

      {/* STYLES */}
      <style jsx>{`
        @keyframes appleSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeInSlow {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes appleFadeText {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }

        .animate-appleSpin {
          animation: appleSpin 1s ease-in-out infinite;
        }

        .animate-fadeInSlow {
          animation: fadeInSlow 1s ease forwards;
        }

        .animate-appleFadeText {
          animation: appleFadeText 2.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
