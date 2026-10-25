import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAIGameMasterQuest } from "@/lib/ai/gameMaster";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Only Admins and Game Masters can invoke quest generation." },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Allow default generation
    }

    const { prompt, theme, difficulty, questType, locationCode, stageCount, status, makePublic } = body;
    const initialStatus = makePublic ? "ACTIVE" : (status || "DRAFT");

    const result = await createAIGameMasterQuest({
      prompt,
      theme,
      difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
      questType,
      locationCode,
      stageCount: stageCount ? parseInt(stageCount, 10) : undefined,
      status: initialStatus,
    });

    return NextResponse.json({
      success: true,
      message: `Quest generated successfully via ${result.source}!`,
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate AI quest." },
      { status: 500 }
    );
  }
}

