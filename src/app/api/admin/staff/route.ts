import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { User, CampusLocation } from "@/models";
import { canManageStaff } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageStaff(user)) {
      return NextResponse.json({ success: false, error: "Admin privileges required." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // List active staff members
    const staffQuery: any = {
      role: { $in: ["ADMIN", "MODERATOR", "SAFE_DESK_STAFF"] },
    };
    if (search) {
      staffQuery.$or = [
        { displayName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const staffMembers = await User.find(staffQuery)
      .select("displayName username email role department assignedStationId assignedStationIds accountStatus createdAt")
      .populate("assignedStationId", "name code isSafeDesk building")
      .sort({ createdAt: 1 })
      .lean();

    // If search keyword provided, also find students who can be promoted
    let candidateStudents: any[] = [];
    if (search && search.length >= 2) {
      candidateStudents = await User.find({
        role: "STUDENT",
        accountStatus: "ACTIVE",
        $or: [
          { displayName: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      })
        .select("displayName username email role department trustScore trustTier")
        .limit(8)
        .lean();
    }

    // List available Safe-Desk stations
    const safeDeskStations = await CampusLocation.find({ isSafeDesk: true, isActive: true })
      .select("name code building operatingHours")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        staff: staffMembers,
        candidates: candidateStudents,
        stations: safeDeskStations,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageStaff(user)) {
      return NextResponse.json({ success: false, error: "Admin privileges required." }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { targetUserId, newRole, stationId, reason } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { success: false, error: "Target user ID and new role are required." },
        { status: 400 }
      );
    }

    if (!["STUDENT", "SAFE_DESK_STAFF", "MODERATOR", "ADMIN"].includes(newRole)) {
      return NextResponse.json({ success: false, error: "Invalid role specified." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "A valid audit reason is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "Target user not found." }, { status: 404 });
    }

    // Prevent demoting the primary admin or self-lockout
    if (targetUser._id.toString() === user._id.toString() && newRole !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "You cannot demote your own administrator account." },
        { status: 400 }
      );
    }

    const previousState = {
      role: targetUser.role,
      assignedStationId: targetUser.assignedStationId,
    };

    targetUser.role = newRole;
    if (newRole === "SAFE_DESK_STAFF" && stationId) {
      targetUser.assignedStationId = stationId;
    } else if (newRole !== "SAFE_DESK_STAFF") {
      targetUser.assignedStationId = null;
    }

    await targetUser.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "ROLE_GRANT",
      targetType: "USER",
      targetId: targetUser._id,
      targetLabel: `${targetUser.displayName} (${targetUser.email})`,
      reason,
      beforeState: previousState,
      afterState: { role: targetUser.role, assignedStationId: targetUser.assignedStationId },
    });

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.displayName} role updated to ${newRole}.`,
      data: {
        userId: targetUser._id,
        role: targetUser.role,
        assignedStationId: targetUser.assignedStationId,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

