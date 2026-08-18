import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` merges clsx + tailwind-merge, so conditional classes and conflicting
 * Tailwind utilities resolve deterministically (latest wins).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}