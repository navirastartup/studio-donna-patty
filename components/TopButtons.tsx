"use client";

import { useCart } from "@/context/CartContext";
import { Info } from "lucide-react";
import FloatingCartButton from "./FloatingCartButton";

export default function TopButtons({
  showSystemInfoButton,
  hideCart,
  onOpenInfo,
}: {
  showSystemInfoButton: boolean;
  hideCart: boolean;
  onOpenInfo: () => void;
}) {
  const { cart } = useCart();
  const hasItems = cart.length > 0;

  return (
    <>
      {/* HOME */}
      {showSystemInfoButton && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          <button
            onClick={onOpenInfo}
            className="
              flex items-center gap-2 bg-[#111]/70 backdrop-blur-md
              border border-[#E8DCC3]/40 px-4 py-2 rounded-full
              text-[#E8DCC3] text-sm font-medium hover:bg-[#1b1b1b]
              transition-all
            "
          >
            <Info className="w-4 h-4" />
            Sobre Navira
          </button>

          {hasItems && !hideCart && <FloatingCartButton />}
        </div>
      )}

      {/* OUTRAS TELAS */}
      {!showSystemInfoButton && hasItems && !hideCart && <FloatingCartButton />}
    </>
  );
}
