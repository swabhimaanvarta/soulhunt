import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CampusLocation } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { isWithinCampusBounds } from "@/lib/campus-constants";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const safeDeskOnly = searchParams.get("safeDesk") === "true";
    const search = (searchParams.get("search") || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const query: any = {};
    if (safeDeskOnly) query.isSafeDesk = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { building: { $regex: search, $options: "i" } },
      ];
    }

    const locations = await CampusLocation.find(query)
      .sort({ isSafeDesk: -1, name: 1 })
      .populate("assignedStaffUserIds", "displayName username email role")
      .lean();

    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();

    const {
      name,
      code,
      zoneType = "ACADEMIC_BLOCK",
      description = "",
      lat = 15.5975,
      lng = 73.7943,
      mapX = 50,
      mapY = 50,
      floors = ["Ground Floor"],
      isSafeDesk = false,
      operatingHours = "08:00 AM - 06:00 PM",
      building = "",
      accessibleRouteNotes = "",
      staffedHoursNotes = "",
      contactChannel = "",
      currentCapacity = 50,
    } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: "Location name and unique code are required." }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();
    const existing = await CampusLocation.findOne({ code: upperCode });
    if (existing) {
      return NextResponse.json({ success: false, error: `Location code ${upperCode} is already registered.` }, { status: 409 });
    }

    const numLat = Number(lat);
    const numLng = Number(lng);
    if (!isWithinCampusBounds(numLat, numLng)) {
      return NextResponse.json(
        {
          success: false,
          error: `Coordinates (${numLat.toFixed(5)}, ${numLng.toFixed(5)}) are outside the approved AIEM campus perimeter.`,
        },
        { status: 400 }
      );
    }

    const location = await CampusLocation.create({
      name: name.trim(),
      code: upperCode,
      zoneType,
      description: description.trim(),
      coordinates: {
        lat: Number(lat),
        lng: Number(lng),
        mapX: Number(mapX),
        mapY: Number(mapY),
      },
      floors: Array.isArray(floors) ? floors : [floors],
      isSafeDesk: Boolean(isSafeDesk),
      operatingHours: operatingHours || "08:00 AM - 06:00 PM",
      building: building.trim(),
      accessibleRouteNotes: accessibleRouteNotes.trim(),
      staffedHoursNotes: staffedHoursNotes.trim(),
      contactChannel: contactChannel.trim(),
      currentCapacity: Number(currentCapacity || 50),
      isActive: true,
      isArchived: false,
    });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: isSafeDesk ? "SAFEDESK_STATION_CREATED" : "CAMPUS_LOCATION_CREATED",
      targetType: "LOCATION",
      targetId: location._id,
      targetLabel: `${location.name} (${location.code})`,
      reason: `Registered campus location ${location.code} [Safe-Desk: ${location.isSafeDesk}].`,
      afterState: { name: location.name, code: location.code, isSafeDesk: location.isSafeDesk },
    });

    return NextResponse.json({
      success: true,
      message: `Location "${location.name}" successfully registered.`,
      data: location,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

