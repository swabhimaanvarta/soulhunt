import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CampusLocation } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const safeDeskOnly = searchParams.get("safeDesk") === "true";

    const filter: any = { isActive: true };
    if (safeDeskOnly) {
      filter.isSafeDesk = true;
    }

    const locations = await CampusLocation.find(filter).sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    await connectDB();

    const location = await CampusLocation.create(body);
    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

