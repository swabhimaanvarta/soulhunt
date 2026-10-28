import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAIGameMasterQuest } from "@/lib/ai/gameMaster";
import { checkRateLimit } from "@/lib/rateLimit";

const GenerateQuestRequestSchema = z.object({
  prompt: z.string().max(1000).optional(),
  theme: z.string().max(100).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  questType: z.enum([
    "QUICK_FIND",
    "INVESTIGATION",
    "MYSTERY",
    "LEGENDARY",
    "DAILY_HUNT",
    "SQUAD_HUNT",
    "CAMPUS_TREASURE",
  ]).optional(),
  locationCode: z.string().max(20).optional(),
  stageCount: z.coerce.number().int().min(1).max(6).optional(),
  courseId: z.string().optional(),
  courseCode: z.string().max(20).optional(),
  courseName: z.string().max(100).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  moduleTitle: z.string().max(150).optional(),
  topic: z.string().max(150).optional(),
  learningOutcome: z.string().max(250).optional(),
  approvedSyllabusText: z.string().max(4000).optional(),
  expectedDurationMinutes: z.coerce.number().int().min(5).max(120).optional(),
  preferredProvider: z.enum(["GEMINI", "OPENAI", "TEMPLATE", "AUTO"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Only Admins and Game Masters can invoke quest generation." },
        { status: 403 }
      );
    }

    // Rate limiting: max 12 AI quest generations per hour per staff member to prevent quota abuse
    const rateLimit = await checkRateLimit(`ai_quest_gen_${user._id}`, 12, 3600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation rate limit reached. Please wait before generating more quests.",
        },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Allow default generation
    }

    const parsed = GenerateQuestRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid quest generation parameters.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Hard constraint: EVERY AI quest generation MUST be saved as a DRAFT.
    // Direct auto-publishing via makePublic is intentionally disbarred; publication requires deliberate staff review.
    const result = await createAIGameMasterQuest({
      prompt: input.prompt,
      theme: input.theme,
      difficulty: input.difficulty,
      questType: input.questType,
      locationCode: input.locationCode,
      stageCount: input.stageCount,
      courseId: input.courseId,
      courseCode: input.courseCode,
      courseName: input.courseName,
      semester: input.semester,
      moduleTitle: input.moduleTitle,
      topic: input.topic,
      learningOutcome: input.learningOutcome,
      approvedSyllabusText: input.approvedSyllabusText,
      expectedDurationMinutes: input.expectedDurationMinutes,
      preferredProvider: input.preferredProvider,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Course-aligned quest drafted successfully via ${result.source}! Review clue stages and safety rationale before publishing.`,
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate AI quest." },
      { status: 500 }
    );
  }
}
