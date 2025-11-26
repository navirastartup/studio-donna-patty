"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

export default function PremiumCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const month = current.toLocaleString("pt-BR", { month: "long" });
  const year = current.getFullYear();

  const daysInMonth = new Date(year, current.getMonth() + 1, 0).getDate();
  const firstDay = new Date(year, current.getMonth(), 1).getDay();

  function selectDay(day: number) {
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const date = `${year}-${m}-${d}`;
    onChange(date);
    setOpen(false);
  }

  const selectedDate = value ? new Date(value) : null;

  return (
    <div className="relative w-full" ref={ref}>
      {/* BOTÃO */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-gray-900 border border-[#D6C6AA]/30 rounded-xl px-4 py-3 text-left flex items-center justify-between text-gray-100 hover:border-[#D6C6AA]/70 transition"
      >
        <span>
{value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR") : "Selecione a data"}
        </span>
        <CalendarDays className="w-5 h-5 text-[#D6C6AA]" />
      </button>

      {/* CALENDÁRIO */}
      {open && (
        <div className="absolute z-50 mt-2 w-80 bg-gray-950/95 backdrop-blur-xl border border-[#D6C6AA]/25 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.60)] p-4 animate-fadeSlide">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() =>
                setCurrent(new Date(year, current.getMonth() - 1, 1))
              }
              className="p-1 hover:bg-gray-800 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5 text-[#D6C6AA]" />
            </button>

            <p className="uppercase tracking-wide text-[#D6C6AA] font-medium">
              {month} {year}
            </p>

            <button
              onClick={() =>
                setCurrent(new Date(year, current.getMonth() + 1, 1))
              }
              className="p-1 hover:bg-gray-800 rounded-lg"
            >
              <ChevronRight className="w-5 h-5 text-[#D6C6AA]" />
            </button>
          </div>

          {/* DIAS DA SEMANA */}
          <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-2">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          {/* DIAS */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espaços brancos */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {/* Dias */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateObj = new Date(year, current.getMonth(), day);

              // bloquear dias anteriores
              const isPast = dateObj < today;

// cria data SEM UTC, baseada literalmente nos números do input
function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month: month - 1, day }; 
}

const parsed = value ? parseLocalDate(value) : null;

const isSelected =
  parsed &&
  parsed.day === day &&
  parsed.month === current.getMonth() &&
  parsed.year === current.getFullYear();


              return (
                <button
                  key={`day-${day}`}
                  disabled={isPast}
                  onClick={() => !isPast && selectDay(day)}
                  className={`p-2 text-sm rounded-lg transition ${
                    isPast
                      ? "text-gray-600 cursor-not-allowed bg-gray-800/30"
                      : isSelected
                      ? "bg-[#D6C6AA]/20 text-[#D6C6AA] border border-[#D6C6AA]/40 shadow-[0_0_18px_rgba(214,198,170,0.25)]"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-fadeSlide {
          animation: fadeSlide 0.18s ease-out;
        }
        @keyframes fadeSlide {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
