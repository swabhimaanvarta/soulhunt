import { ItemCategory } from "@/models";

const SENSITIVE_CATEGORIES: ItemCategory[] = [
  "ID_CARDS_DOCS",
  "BAGS_WALLETS",
  "KEYS",
  "ELECTRONICS",
];

export function sanitizePublicDescription(rawText: string): {
  sanitizedText: string;
  wasRedacted: boolean;
} {
  let wasRedacted = false;
  const digitPattern = /\b\d{8,16}\b/g;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  let sanitizedText = rawText.replace(digitPattern, () => {
    wasRedacted = true;
    return "[REDACTED-ID/NUMBER]";
  });

  sanitizedText = sanitizedText.replace(emailPattern, () => {
    wasRedacted = true;
    return "[REDACTED-EMAIL]";
  });

  return { sanitizedText, wasRedacted };
}

export const sanitizeSensitiveText = sanitizePublicDescription;

export function requiresAutomaticPhotoBlur(category: ItemCategory): boolean {
  return SENSITIVE_CATEGORIES.includes(category);
}

export function normalizeClueAnswer(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
