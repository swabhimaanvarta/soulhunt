import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CampusLocation, LostItem, FoundItem, Quest, Event } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { isWithinCampusBounds } from "@/lib/campus-constants";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const location = await CampusLocation.findById(id);
    if (!location) {
      return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });
    }

    const previousState = {
      name: location.name,
      code: location.code,
      operatingHours: location.operatingHours,
      isSafeDesk: location.isSafeDesk,
      isActive: location.isActive,
      coordinates: location.coordinates,
    };

    // Coordinate validation
    let newLat = location.coordinates?.lat ?? 15.5948;
    let newLng = location.coordinates?.lng ?? 73.7947;

    if (body.coordinates) {
      newLat = Number(body.coordinates.lat ?? newLat);
      newLng = Number(body.coordinates.lng ?? newLng);
    } else if (body.lat !== undefined || body.lng !== undefined) {
      newLat = Number(body.lat ?? newLat);
      newLng = Number(body.lng ?? newLng);
    }

    if (!isWithinCampusBounds(newLat, newLng)) {
      return NextResponse.json(
        {
          success: false,
          error: `Coordinates (${newLat.toFixed(5)}, ${newLng.toFixed(5)}) are outside the approved AIEM campus perimeter.`,
        },
        { status: 400 }
      );
    }

    // Require reason when moving an operational safe desk
    const isMovingSafeDesk =
      location.isSafeDesk &&
      (Math.abs(newLat - (location.coordinates?.lat || 0)) > 0.0001 ||
        Math.abs(newLng - (location.coordinates?.lng || 0)) > 0.0001);

    if (isMovingSafeDesk && (!body.reason || !body.reason.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: "Relocating an operational safe desk strictly requires an administrative reason for security audit.",
        },
        { status: 400 }
      );
    }

    // Prevent duplicate codes
    if (body.code && body.code.trim().toUpperCase() !== location.code) {
      const codeCandidate = body.code.trim().toUpperCase();
      const existing = await CampusLocation.findOne({ code: codeCandidate, _id: { $ne: location._id } });
      if (existing) {
        return NextResponse.json(
          { success: false, error: `Location code ${codeCandidate} is already registered.` },
          { status: 409 }
        );
      }
      location.code = codeCandidate;
    }

    if (body.name) location.name = body.name.trim();
    if (body.zoneType) location.zoneType = body.zoneType;
    if (body.description !== undefined) location.description = body.description.trim();
    if (body.operatingHours) location.operatingHours = body.operatingHours.trim();
    if (body.floors && Array.isArray(body.floors)) location.floors = body.floors;
    if (body.building !== undefined) location.building = body.building.trim();
    if (body.accessibleRouteNotes !== undefined) location.accessibleRouteNotes = body.accessibleRouteNotes.trim();
    if (body.staffedHoursNotes !== undefined) location.staffedHoursNotes = body.staffedHoursNotes.trim();
    if (body.contactChannel !== undefined) location.contactChannel = body.contactChannel.trim();
    if (body.currentCapacity !== undefined) location.currentCapacity = Number(body.currentCapacity);
    if (body.isSafeDesk !== undefined) location.isSafeDesk = Boolean(body.isSafeDesk);
    if (body.isActive !== undefined) location.isActive = Boolean(body.isActive);
    if (body.isArchived !== undefined) location.isArchived = Boolean(body.isArchived);

    location.coordinates = {
      lat: newLat,
      lng: newLng,
      mapX: Math.max(0, Math.min(100, Number(body.coordinates?.mapX ?? body.mapX ?? location.coordinates?.mapX ?? 50))),
      mapY: Math.max(0, Math.min(100, Number(body.coordinates?.mapY ?? body.mapY ?? location.coordinates?.mapY ?? 50))),
    };
    location.updatedBy = user._id;

    await location.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "LOCATION_EDITED",
      targetType: "LOCATION",
      targetId: location._id,
      targetLabel: `${location.name} (${location.code})`,
      reason: body.reason || "Updated campus location metadata.",
      beforeState: previousState,
      afterState: {
        name: location.name,
        code: location.code,
        coordinates: location.coordinates,
        isSafeDesk: location.isSafeDesk,
        isActive: location.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Location "${location.name}" successfully updated.`,
      data: location,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { action, isActive, isArchived, reason } = body;

    const location = await CampusLocation.findById(id);
    if (!location) {
      return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });
    }

    const previousState = { isActive: location.isActive, isArchived: location.isArchived };

    if (action === "ARCHIVE" || isArchived === true) {
      location.isArchived = true;
      location.isActive = false;
    } else if (action === "REACTIVATE") {
      location.isArchived = false;
      location.isActive = true;
    } else if (isActive !== undefined) {
      location.isActive = Boolean(isActive);
    }

    location.updatedBy = user._id;
    await location.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: location.isArchived ? "LOCATION_ARCHIVED" : location.isActive ? "LOCATION_ACTIVATED" : "LOCATION_DEACTIVATED",
      targetType: "LOCATION",
      targetId: location._id,
      targetLabel: `${location.name} (${location.code})`,
      reason: reason || `Updated location state (active: ${location.isActive}, archived: ${location.isArchived})`,
      beforeState: previousState,
      afterState: { isActive: location.isActive, isArchived: location.isArchived },
    });

    return NextResponse.json({
      success: true,
      message: `Location "${location.name}" state updated (Active: ${location.isActive}, Archived: ${location.isArchived}).`,
      data: location,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const location = await CampusLocation.findById(id);
    if (!location) {
      return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });
    }

    // Check if referenced by items, quests, or events
    const [lostCount, foundCount, questCount] = await Promise.all([
      LostItem.countDocuments({ lastKnownLocationId: location._id }),
      FoundItem.countDocuments({
        $or: [
          { foundLocationId: location._id },
          { safeDeskLocationId: location._id },
          { currentCustodyLocationId: location._id },
        ],
      }),
      Quest.countDocuments({ targetLocationId: location._id }),
    ]);

    const targetQuests = await Quest.find({ targetLocationId: location._id }).select("_id").lean();
    const targetQuestIds = targetQuests.map((q) => q._id);
    const eventCount = targetQuestIds.length > 0 ? await Event.countDocuments({ linkedQuestIds: { $in: targetQuestIds } }) : 0;

    const totalRefs = lostCount + foundCount + questCount + eventCount;

    // UI "Delete" means archive when referenced
    if (totalRefs > 0) {
      location.isActive = false;
      location.isArchived = true;
      location.updatedBy = user._id;
      await location.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "LOCATION_ARCHIVED",
        targetType: "LOCATION",
        targetId: location._id,
        targetLabel: `${location.name} (${location.code})`,
        reason: `Safely archived location with ${totalRefs} historical references instead of hard-deleting.`,
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Location "${location.name}" is referenced by ${totalRefs} items/quests. It has been safely archived instead of hard-deleted.`,
        data: location,
      });
    }

    // Hard delete allowed ONLY for unused draft pins
    await CampusLocation.deleteOne({ _id: location._id });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "LOCATION_DELETED",
      targetType: "LOCATION",
      targetId: location._id,
      targetLabel: `${location.name} (${location.code})`,
      reason: "Hard deleted unused pin.",
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Unused draft location "${location.name}" has been permanently deleted.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
