import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  SystemConfig,
  User,
  LostItem,
  FoundItem,
  Quest,
  Investigation,
  FraudAlert,
  Transaction,
} from "@/models";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ success: false, error: "Admin/Moderator access required." }, { status: 403 });
    }

    await connectDB();

    const [
      config,
      totalUsers,
      totalLost,
      totalFound,
      totalRecovered,
      activeQuests,
      fraudAlerts,
      recentTransactions,
    ] = await Promise.all([
      SystemConfig.findOne({ key: "GLOBAL_CONFIG" }).lean(),
      User.countDocuments(),
      LostItem.countDocuments(),
      FoundItem.countDocuments(),
      LostItem.countDocuments({ status: { $in: ["RECOVERED", "COMPLETED"] } }),
      Quest.countDocuments({ status: "ACTIVE" }),
      FraudAlert.find().sort({ createdAt: -1 }).limit(20).populate("involvedUserIds", "displayName username email").lean(),
      Transaction.find().sort({ createdAt: -1 }).limit(15).populate("userId", "displayName username").lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        config,
        stats: {
          totalUsers,
          totalLost,
          totalFound,
          totalRecovered,
          activeQuests,
          openFraudAlerts: fraudAlerts.filter((f) => f.status === "OPEN").length,
        },
        fraudAlerts,
        recentTransactions,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

