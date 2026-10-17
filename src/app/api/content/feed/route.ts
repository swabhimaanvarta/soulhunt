import { NextRequest, NextResponse } from "next/server";
import { getLivingCampusFeed } from "@/lib/content/contentEngine";

export async function GET(req: NextRequest) {
  try {
    const feed = await getLivingCampusFeed();
    return NextResponse.json({
      success: true,
      data: feed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load activity feed." },
      { status: 500 }
    );
  }
}

