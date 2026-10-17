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
      return NextResponse.json({ success: false, error: "Please sign in to join a squad." }, { status: 401 });
    }

    if (user.squadId) {
      return NextResponse.json({ success: false, error: "You are already a member of a squad." }, { status: 400 });
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return NextResponse.json({ success: false, error: "Squad not found" }, { status: 404 });
    }

    const memberCount = await SquadMember.countDocuments({ squadId: squad._id });
    if (memberCount >= 8) {
      return NextResponse.json({ success: false, error: "This squad is currently full (max 8 members)." }, { status: 400 });
    }

    await SquadMember.create({
      squadId: squad._id,
      userId: user._id,
      squadRole: "MEMBER",
      joinedAt: new Date(),
    });

    await User.findByIdAndUpdate(user._id, { $set: { squadId: squad._id } });

    return NextResponse.json({ success: true, message: `Joined ${squad.name} successfully!` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

