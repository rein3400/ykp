"use client";
import { useMemo } from "react";

const PALETTES = [
  "from-blue-600 to-indigo-700",
  "from-emerald-700 to-teal-700",
  "from-purple-600 to-pink-700",
  "from-orange-700 to-rose-700",
  "from-amber-700 to-orange-700",
  "from-sky-700 to-cyan-700",
  "from-fuchsia-700 to-purple-700",
  "from-rose-700 to-red-700"
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