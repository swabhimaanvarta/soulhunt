import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Investigation, Quest, Clue, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in to view this investigation." } },
        { status: 401 }
      );
    }

    const investigationDoc = await Investigation.findById(id);
    if (!investigationDoc) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Investigation not found." } },
        { status: 404 }
      );
    }

    const callerId = user._id.toString();
    const isOwner = investigationDoc.userId?.toString() === callerId;
    const isSquadMember = Boolean(
      investigationDoc.squadId &&
      user.squadId &&
      investigationDoc.squadId.toString() === user.squadId.toString()
    );
    const isParticipant =
      isOwner ||
      isSquadMember ||
      (Array.isArray(investigationDoc.participatingUserIds) &&
        investigationDoc.participatingUserIds.some((p: any) => p.toString() === callerId)) ||
      user.role === "ADMIN" ||
      user.role === "MODERATOR";

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You are not authorized to view this investigation." } },
        { status: 403 }
      );
    }

    const isCompleted = ["COMPLETED", "READY_FOR_RECOVERY", "SUBMITTED_FOR_VERIFICATION"].includes(
      investigationDoc.status
    );

    let investigation: any;
    if (isCompleted) {
      const fullDoc = await Investigation.findById(id)
        .select("+stageVariants.customExpectedAnswer +stageVariants.acceptableAnswers +stageVariants.explanation")
        .lean();
      investigation = fullDoc || investigationDoc.toObject();
    } else {
      investigation = investigationDoc.toObject();
      if (investigation.stageVariants && Array.isArray(investigation.stageVariants)) {
        investigation.stageVariants = investigation.stageVariants.map((v: any) => {
          const { customExpectedAnswer, acceptableAnswers, explanation, ...safeVariant } = v;
          return safeVariant;
        });
      }
    }

    const clueProjection = isCompleted
      ? "+expectedAnswerNormalized +correctOptionId"
      : "-expectedAnswerNormalized -correctOptionId -acceptableAnswers -explanation";

    const [quest, rawClues, squad] = await Promise.all([
      Quest.findById(investigation.questId).populate("targetLocationId").lean(),
      Clue.find({ questId: investigation.questId })
        .select(clueProjection)
        .sort({ stageOrder: 1 })
        .populate("targetLocationId")
        .lean(),
      investigation.squadId ? Squad.findById(investigation.squadId).lean() : null,
    ]);

    let clues = rawClues;
    if (!isCompleted && Array.isArray(clues)) {
      clues = clues.map((c: any) => {
        const safeClue = { ...c };
        delete safeClue.expectedAnswerNormalized;
        delete safeClue.correctOptionId;
        delete safeClue.acceptableAnswers;
        delete safeClue.explanation;
        if (safeClue.variantTemplate) {
          const { formula, explanationTemplate, ...safeTpl } = safeClue.variantTemplate;
          safeClue.variantTemplate = safeTpl;
        }
        return safeClue;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        investigation,
        quest,
        clues,
        squad,
        currentUser: { id: user._id, username: user.username, displayName: user.displayName, coins: user.coins },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


