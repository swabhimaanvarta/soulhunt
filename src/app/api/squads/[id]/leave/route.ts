import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please sign in." }, { status: 401 });
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return NextResponse.json({ success: false, error: "Squad not found" }, { status: 404 });
    }

    await SquadMember.findOneAndDelete({ squadId: squad._id, userId: user._id });
    await User.findByIdAndUpdate(user._id, { $unset: { squadId: 1 } });

    // If leader left, promote highest XP member
    if (squad.leaderId.toString() === user._id.toString()) {
      const nextLeader = await SquadMember.findOne({ squadId: squad._id }).sort({ contributedSquadXp: -1 });
      if (nextLeader) {
        squad.leaderId = nextLeader.userId;
        nextLeader.role = "LEADER";
        await Promise.all([squad.save(), nextLeader.save()]);
      }
    }

    return NextResponse.json({ success: true, message: "Left squad successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
