import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  SystemConfig,
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  Quest,
  FraudAlert,
  Transaction,
  AuditEvent,
  CampusLocation,
} from "@/models";
import {
  canAccessAdminPanel,
  canManageEconomy,
  canManageStaff,
  canManageContent,
  canResolveFraud,
} from "@/lib/permissions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessAdminPanel(user)) {
      return NextResponse.json(
        { success: false, error: "Access denied: Staff, Moderator, or Admin privileges required." },
        { status: 403 }
      );
    }

    await connectDB();

    const isStaffOnly = user.role === "SAFE_DESK_STAFF";
    const userStationId = user.assignedStationId;

    // Station custody filter
    const custodyFilter: any = {
      custodyStatus: { $in: ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"] },
      status: { $nin: ["COMPLETED", "RECOVERED", "ARCHIVED"] },
    };
    if (isStaffOnly && userStationId) {
      custodyFilter.safeDeskLocationId = userStationId;
    }

    const [
      config,
      totalUsers,
      totalLost,
      totalFound,
      totalRecovered,
      activeQuests,
      fraudAlerts,
      recentTransactions,
      recentAuditLogs,
      reportsNeedingReviewLost,
      reportsNeedingReviewFound,
      claimsAwaitingReview,
      approvedHandovers,
      stationCustodyItems,
      disputesCount,
      safeDesksList,
    ] = await Promise.all([
      user.role === "ADMIN" ? SystemConfig.findOne({ key: "GLOBAL_CONFIG" }).lean() : null,
      User.countDocuments(),
      LostItem.countDocuments(),
      FoundItem.countDocuments(),
      LostItem.countDocuments({ status: { $in: ["RECOVERED", "COMPLETED"] } }),
      Quest.countDocuments({ status: "ACTIVE" }),
      canResolveFraud(user)
        ? FraudAlert.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .populate("involvedUserIds", "displayName username email")
            .lean()
        : [],
      canManageEconomy(user)
        ? Transaction.find()
            .sort({ createdAt: -1 })
            .limit(15)
            .populate("userId", "displayName username")
            .lean()
        : [],
      AuditEvent.find().sort({ createdAt: -1 }).limit(12).lean(),
      LostItem.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } }),
      FoundItem.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } }),
      ClaimRequest.countDocuments({ status: "PENDING" }),
      ClaimRequest.countDocuments({ status: "APPROVED" }),
      FoundItem.countDocuments(custodyFilter),
      ClaimRequest.countDocuments({ status: { $in: ["DISPUTED", "LOCKED"] } }),
      CampusLocation.find({ isSafeDesk: true, isActive: true }).select("name code operatingHours building currentCapacity").lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          displayName: user.displayName,
          username: user.username,
          role: user.role,
          assignedStationId: user.assignedStationId,
        },
        permissions: {
          canManageEconomy: canManageEconomy(user),
          canManageStaff: canManageStaff(user),
          canManageContent: canManageContent(user),
          canResolveFraud: canResolveFraud(user),
          isSafeDeskStaff: user.role === "SAFE_DESK_STAFF",
        },
        config,
        stats: {
          totalUsers,
          totalLost,
          totalFound,
          totalRecovered,
          activeQuests,
          openFraudAlerts: Array.isArray(fraudAlerts)
            ? fraudAlerts.filter((f: any) => f.status === "OPEN").length
            : 0,
        },
        queues: {
          reportsNeedingReview: reportsNeedingReviewLost + reportsNeedingReviewFound,
          claimsAwaitingReview,
          approvedHandovers,
          stationCustodyItems,
          disputesAndOverdue: disputesCount,
        },
        fraudAlerts,
        recentTransactions,
        recentAuditLogs,
        safeDesks: safeDesksList,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
