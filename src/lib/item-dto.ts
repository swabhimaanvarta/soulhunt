// Strict allowlisted DTO projection for Lost & Found items
import { sanitizePublicDescription } from "./privacy";

export function sanitizeItemTitle(rawTitle: string): string {
  if (!rawTitle) return "Campus Item";

  let sanitized = rawTitle
    // Remove parenthesized student IDs like (23COMP042) or (Roll No 42) or (2024CS099)
    .replace(/\s*\(\s*(?:(?:ID|Roll(?:\s*No\.?)?)[:\s-]*)?[0-9]{2,4}[A-Z]{2,5}[0-9]{2,5}\s*\)/gi, "")
    // Remove slash-style student/matriculation codes like (AIEM/2024/CS/042)
    .replace(/\s*\(\s*[A-Z0-9]{2,6}\/[0-9]{4}\/[A-Z0-9\/]+\s*\)/gi, "")
    // Remove prefixed or standalone roll numbers / student IDs like ID 2024CS099, 23COMP042, 22MECH015
    .replace(/(?:(?:ID|Roll(?:\s*No\.?)?)[:\s-]*)?[0-9]{2,4}[A-Z]{2,5}[0-9]{2,5}\b/gi, "")
    // Remove barcode / student matriculation number patterns (e.g. #2024987654)
    .replace(/#?[0-9]{7,12}\b/g, "")
    .trim();

  // Clean up any double spaces or dangling hyphens/colons
  sanitized = sanitized.replace(/\s*[-–:]\s*$/, "").trim();
  sanitized = sanitized.replace(/\s{2,}/g, " ");

  return sanitized || "Campus Item";
}

export function toPublicItemDTO(item: any, itemType: "LOST" | "FOUND", isStaff: boolean = false) {
  const rawLoc = itemType === "LOST" ? item.lastKnownLocationId : item.foundLocationId;
  const safeLoc = rawLoc
    ? {
        _id: rawLoc._id,
        name: rawLoc.name,
        code: rawLoc.code,
        zoneType: rawLoc.zoneType,
        isSafeDesk: Boolean(rawLoc.isSafeDesk),
        operatingHours: rawLoc.operatingHours,
      }
    : undefined;

  // Never fall back to unreviewed raw image; only blurred or redacted
  const safePhoto = item.blurredPhotoUrl || "";

  return {
    _id: item._id,
    itemType,
    title: sanitizeItemTitle(item.title || item.shortTitle),
    category: item.category,
    publicDescription: sanitizePublicDescription(item.publicDescription || "").sanitizedText,
    status: item.status,
    custodyStatus: item.custodyStatus,
    safeDeskLocationId: item.safeDeskLocationId || item.currentCustodyLocationId?._id || item.currentCustodyLocationId,
    location: safeLoc,
    photoUrl: safePhoto,
    // Personal identities only visible to authorized staff
    reporter: isStaff && item.reporterId ? { displayName: item.reporterId.displayName, username: item.reporterId.username } : undefined,
    finder: isStaff && item.finderId ? { displayName: item.finderId.displayName, username: item.finderId.username } : undefined,
    createdAt: item.createdAt,
    dateReported: item.lostAt || item.foundAt || item.createdAt,
    ...(isStaff ? {
      lockerReceiptCode: item.lockerReceiptCode,
      currentCustodyLocationId: item.currentCustodyLocationId,
      rawLocation: rawLoc,
    } : {}),
  };
}
