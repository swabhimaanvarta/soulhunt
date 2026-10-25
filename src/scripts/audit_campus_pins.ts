import { connectDB } from "../lib/db";
import { CampusLocation, LostItem, FoundItem, Quest, Event } from "../models";

import { isWithinCampusBounds } from "../lib/campus-constants";

export interface PinAuditReport {
  totalPins: number;
  activePins: number;
  archivedPins: number;
  safeDeskPins: number;
  outOfBoundsPins: { id: string; name: string; code: string; lat: number; lng: number }[];
  duplicateCoordinates: { coords: string; pinIds: string[]; pinNames: string[] }[];
  duplicateCodes: { code: string; pinIds: string[] }[];
  referencedPins: { id: string; name: string; code: string; referencesCount: number }[];
  unreferencedPins: { id: string; name: string; code: string }[];
}

export async function runCampusPinAudit(): Promise<PinAuditReport> {
  await connectDB();

  console.log("\n========================================================");
  console.log("🗺️  AIEM HUNT — CAMPUS PIN DATA INTEGRITY AUDIT");
  console.log("========================================================\n");

  const locations = await CampusLocation.find().lean();

  const report: PinAuditReport = {
    totalPins: locations.length,
    activePins: locations.filter((l) => l.isActive && !l.isArchived).length,
    archivedPins: locations.filter((l) => l.isArchived).length,
    safeDeskPins: locations.filter((l) => l.isSafeDesk).length,
    outOfBoundsPins: [],
    duplicateCoordinates: [],
    duplicateCodes: [],
    referencedPins: [],
    unreferencedPins: [],
  };

  const coordsMap = new Map<string, { ids: string[]; names: string[] }>();
  const codeMap = new Map<string, string[]>();

  for (const loc of locations) {
    const lat = loc.coordinates?.lat;
    const lng = loc.coordinates?.lng;
    const locId = loc._id.toString();

    // Check bounds
    if (lat === undefined || lng === undefined || !isWithinCampusBounds(lat, lng)) {
      report.outOfBoundsPins.push({
        id: locId,
        name: loc.name,
        code: loc.code,
        lat: lat ?? 0,
        lng: lng ?? 0,
      });
    }

    // Check duplicate coordinates
    if (lat !== undefined && lng !== undefined) {
      const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!coordsMap.has(coordKey)) {
        coordsMap.set(coordKey, { ids: [], names: [] });
      }
      coordsMap.get(coordKey)!.ids.push(locId);
      coordsMap.get(coordKey)!.names.push(loc.name);
    }

    // Check duplicate codes
    const codeKey = (loc.code || "").toUpperCase().trim();
    if (!codeMap.has(codeKey)) {
      codeMap.set(codeKey, []);
    }
    codeMap.get(codeKey)!.push(locId);

    // Check references
    const [lostCount, foundCount, questCount] = await Promise.all([
      LostItem.countDocuments({ lastKnownLocationId: loc._id }),
      FoundItem.countDocuments({
        $or: [
          { foundLocationId: loc._id },
          { safeDeskLocationId: loc._id },
          { currentCustodyLocationId: loc._id },
        ],
      }),
      Quest.countDocuments({ targetLocationId: loc._id }),
    ]);

    const totalRefs = lostCount + foundCount + questCount;
    if (totalRefs > 0) {
      report.referencedPins.push({
        id: locId,
        name: loc.name,
        code: loc.code,
        referencesCount: totalRefs,
      });
    } else {
      report.unreferencedPins.push({
        id: locId,
        name: loc.name,
        code: loc.code,
      });
    }
  }

  for (const [coordKey, val] of coordsMap.entries()) {
    if (val.ids.length > 1) {
      report.duplicateCoordinates.push({
        coords: coordKey,
        pinIds: val.ids,
        pinNames: val.names,
      });
    }
  }

  for (const [codeKey, ids] of codeMap.entries()) {
    if (ids.length > 1) {
      report.duplicateCodes.push({
        code: codeKey,
        pinIds: ids,
      });
    }
  }

  console.log(`📌 Total Campus Locations: ${report.totalPins}`);
  console.log(`   - Active: ${report.activePins}`);
  console.log(`   - Archived: ${report.archivedPins}`);
  console.log(`   - Operational Safe Desks: ${report.safeDeskPins}`);
  console.log(`   - Out-of-bounds pins: ${report.outOfBoundsPins.length}`);
  console.log(`   - Duplicate coordinate clusters: ${report.duplicateCoordinates.length}`);
  console.log(`   - Duplicate code clusters: ${report.duplicateCodes.length}`);
  console.log(`   - Referenced by items/quests: ${report.referencedPins.length}`);
  console.log(`   - Unreferenced (safe to delete if unused draft): ${report.unreferencedPins.length}\n`);

  if (report.outOfBoundsPins.length > 0) {
    console.warn("⚠️  Out of bounds pins detected:");
    for (const p of report.outOfBoundsPins) {
      console.warn(`   • [${p.code}] ${p.name}: (${p.lat}, ${p.lng})`);
    }
  }

  return report;
}

if (require.main === module) {
  runCampusPinAudit()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
