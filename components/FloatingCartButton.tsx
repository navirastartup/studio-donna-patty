"use client";

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";

export default function FloatingCartButton() {
  const { cart } = useCart();
  const router = useRouter();
  const count = cart.length;

  return (
    <button
      onClick={() => router.push("/carrinho")}
      className="
        fixed top-4 right-4 z-50
        flex items-center gap-2
        bg-[#111]/70 backdrop-blur-md
        border border-[#E8DCC3]/40
        px-4 py-2 rounded-full
        hover:bg-[#1b1b1b] transition-all
        shadow-lg
      "
    >
      <div className="relative">
        <ShoppingCart className="w-6 h-6 text-[#E8DCC3] animate-pulse" />

        {count > 0 && (
          <span
            className="
              absolute -top-2 -right-2
              bg-[#E8DCC3] text-black
              text-xs font-bold w-5 h-5
              flex items-center justify-center
              rounded-full shadow-md
            "
          >
            {count}
          </span>
        )}
      </div>

      <span className="text-[#E8DCC3] font-medium text-sm">
        Ver carrinho →
      </span>
    </button>
  );
}
