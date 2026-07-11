"use client";
import { useMemo } from "react";

const PALETTES = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-purple-500 to-pink-600",
  "from-orange-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-cyan-600",
  "from-fuchsia-500 to-purple-600",
  "from-rose-500 to-red-600"
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg"
};

export function Avatar({ name, size = "md", className = "" }: AvatarProps) {
  const palette = useMemo(() => PALETTES[hash(name) % PALETTES.length], [name]);
  const initials = useMemo(() => initialsOf(name), [name]);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${palette} text-white font-semibold ring-2 ring-white/20 dark:ring-slate-900/40 ${SIZE[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </span>
  );
}