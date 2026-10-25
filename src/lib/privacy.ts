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
  if (!rawText) return { sanitizedText: "", wasRedacted: false };

  let wasRedacted = false;

  // Email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  // Phone numbers (Indian mobile numbers, international format, landlines)
  const phonePattern = /(?:\+?91[-.\s]?)?[6-9]\d{9}\b|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;

  // Student IDs / roll numbers (e.g. 23COMP042, 22MECH015, 2024CS099, AIEM/2024/CS/042)
  const studentIdPattern = /\b(?:(?:ID|Roll(?:\s*No\.?)?)[:\s-]*)?[0-9]{2,4}[A-Z]{2,5}[0-9]{2,5}\b|\b[A-Z0-9]{2,6}\/[0-9]{4}\/[A-Z0-9\/]+\b/gi;

  // Serial numbers, barcodes, long digit sequences (8-24 digits)
  const digitPattern = /\b\d{8,24}\b/g;

  // IMEI, MAC address or serial patterns like SN-12345678, IMEI: 12345...
  const serialPattern = /\b(?:SN|IMEI|SERIAL|MAC|BARCODE)[:\s-]*[A-Z0-9-]{6,24}\b/gi;

  let sanitizedText = rawText
    .replace(emailPattern, () => {
      wasRedacted = true;
      return "[REDACTED-EMAIL]";
    })
    .replace(phonePattern, () => {
      wasRedacted = true;
      return "[REDACTED-PHONE]";
    })
    .replace(studentIdPattern, () => {
      wasRedacted = true;
      return "[REDACTED-STUDENT-ID]";
    })
    .replace(serialPattern, () => {
      wasRedacted = true;
      return "[REDACTED-SERIAL]";
    })
    .replace(digitPattern, () => {
      wasRedacted = true;
      return "[REDACTED-ID/NUMBER]";
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
