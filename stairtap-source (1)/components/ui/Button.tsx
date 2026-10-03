import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "outline" | "pri" | "acc" | "ghost";
type Size = "sm" | "md" | "lg";

const V: Record<Variant, string> = {
  outline: "border-line2 text-tx hover:bg-white/6 hover:border-white/30",
  pri: "bg-tx text-[#0a0a0b] border-tx hover:bg-white hover:shadow-[0_0_0_4px_rgb(255_255_255/0.1)]",
  acc: "bg-acc text-accfg border-acc hover:brightness-110 hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-acc)_18%,transparent)]",
  ghost: "border-transparent text-tx2 hover:text-tx",
};
const S: Record<Size, string> = {
  sm: "h-11 md:h-9.5 px-3.5 text-[13px] rounded-[10px]",
  md: "h-11 px-4.5 text-sm rounded-xl",
  lg: "h-14 px-7 text-base rounded-[14px]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  wide?: boolean;
}

export function Button({ variant = "outline", size = "md", wide, className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 border font-medium whitespace-nowrap transition active:scale-[0.97]",
        V[variant], S[size], wide && "w-full", className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn("grid size-11 place-items-center rounded-xl border border-line2 text-tx2 transition hover:bg-white/6 hover:text-tx", className)}
      {...rest}
    />
  );
}
