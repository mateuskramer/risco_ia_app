import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decodifica sequências de escape unicode de PDFs e filenames (ex: #U00e7 -> ç, \u00e7 -> ç).
 */
export function cleanFileName(fileName: string | null | undefined): string {
  if (!fileName) return "";
  let result = fileName;
  result = result.replace(/#U([0-9a-fA-F]{4})/gi, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return _;
    }
  });
  result = result.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return _;
    }
  });
  return result;
}

