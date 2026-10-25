import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Quest, Clue, Investigation } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const quest = await Quest.findById(id).populate("targetLocationId", "name code isSafeDesk building").lean();
    if (!quest) {
      return NextResponse.json({ success: false, error: "Quest not found." }, { status: 404 });
    }

    // In admin view, reveal expectedAnswerNormalized for review
    const clues = await Clue.find({ questId: quest._id })
      .select("+expectedAnswerNormalized")
      .sort({ stageOrder: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: { ...quest, clues },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const {
      title,
      description,
      questType,
      difficulty,
      targetLocationId,
      xpReward,
      coinReward,
      squadXpReward,
      finderBonusXp,
      maxCompletions,
      status,
      revisionNote,
    } = body;

    const quest = await Quest.findById(id);
    if (!quest) {
      return NextResponse.json({ success: false, error: "Quest not found." }, { status: 404 });
    }

    const previousState = {
      title: quest.title,
      status: quest.status,
      difficulty: quest.difficulty,
      xpReward: quest.xpReward,
      coinReward: quest.coinReward,
    };

    if (title) quest.title = title.trim();
    if (description) quest.description = description.trim();
    if (questType) quest.questType = questType;
    if (difficulty !== undefined) quest.difficulty = Number(difficulty);
    if (targetLocationId) quest.targetLocationId = targetLocationId;
    if (xpReward !== undefined) quest.xpReward = Number(xpReward);
    if (coinReward !== undefined) quest.coinReward = Number(coinReward);
    if (squadXpReward !== undefined) quest.squadXpReward = Number(squadXpReward);
    if (finderBonusXp !== undefined) quest.finderBonusXp = Number(finderBonusXp);
    if (maxCompletions !== undefined) quest.maxCompletions = Number(maxCompletions);
    if (status && ["DRAFT", "ACTIVE", "COMPLETED", "EXPIRED", "ARCHIVED"].includes(status)) {
      quest.status = status;
    }

    if (!quest.revisions) quest.revisions = [];
    quest.revisions.push({
      editedBy: user._id,
      editedByName: user.displayName,
      note: revisionNote || "Updated quest parameters.",
      timestamp: new Date(),
    });

    await quest.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "QUEST_EDITED",
      targetType: "QUEST",
      targetId: quest._id,
      targetLabel: quest.title,
      reason: revisionNote || "Updated quest configuration.",
      beforeState: previousState,
      afterState: {
        title: quest.title,
        status: quest.status,
        difficulty: quest.difficulty,
        xpReward: quest.xpReward,
        coinReward: quest.coinReward,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Quest "${quest.title}" successfully updated.`,
      data: quest,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { targetStatus, reason } = body;

    if (!["DRAFT", "ACTIVE", "COMPLETED", "EXPIRED", "ARCHIVED"].includes(targetStatus)) {
      return NextResponse.json({ success: false, error: "Invalid target status." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "A valid audit reason is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    const quest = await Quest.findById(id);
    if (!quest) {
      return NextResponse.json({ success: false, error: "Quest not found." }, { status: 404 });
    }

    const previousStatus = quest.status;
    quest.status = targetStatus;

    if (!quest.revisions) quest.revisions = [];
    quest.revisions.push({
      editedBy: user._id,
      editedByName: user.displayName,
      note: `Status transition: ${previousStatus} -> ${targetStatus}. Reason: ${reason}`,
      timestamp: new Date(),
    });

    await quest.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: targetStatus === "ARCHIVED" ? "QUEST_ARCHIVED" : targetStatus === "ACTIVE" ? "QUEST_PUBLISHED" : "QUEST_STATUS_CHANGED",
      targetType: "QUEST",
      targetId: quest._id,
      targetLabel: quest.title,
      reason,
      beforeState: { status: previousStatus },
      afterState: { status: targetStatus },
    });

    return NextResponse.json({
      success: true,
      message: `Quest status updated to ${targetStatus}.`,
      data: { questId: quest._id, status: quest.status },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Duplicate quest into a new DRAFT
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const source = await Quest.findById(id).lean();
    if (!source) {
      return NextResponse.json({ success: false, error: "Source quest not found." }, { status: 404 });
    }

    const newCode = `Q-${source.questType.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
    const duplicatedQuest = await Quest.create({
      ...source,
      _id: undefined,
      questCode: newCode,
      title: `${source.title} (Draft Copy)`,
      status: "DRAFT",
      currentCompletions: 0,
      generationSource: "ADMIN",
      createdAt: undefined,
      updatedAt: undefined,
      revisions: [
        {
          editedBy: user._id,
          editedByName: user.displayName,
          note: `Duplicated from quest "${source.title}" (${source.questCode})`,
          timestamp: new Date(),
        },
      ],
    });

    // Copy clues
    const sourceClues = await Clue.find({ questId: source._id }).select("+expectedAnswerNormalized").lean();
    for (const c of sourceClues) {
      await Clue.create({
        questId: duplicatedQuest._id,
        stageOrder: c.stageOrder,
        title: c.title,
        clueText: c.clueText,
        verificationType: c.verificationType,
        expectedAnswerNormalized: c.expectedAnswerNormalized,
        hintText: c.hintText,
        hintCoinCost: c.hintCoinCost,
        unlockedBreadcrumbText: c.unlockedBreadcrumbText,
      });
    }

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "QUEST_DUPLICATED",
      targetType: "QUEST",
      targetId: duplicatedQuest._id,
      targetLabel: duplicatedQuest.title,
      reason: `Duplicated from ${source.questCode}`,
      afterState: { questCode: newCode, title: duplicatedQuest.title, sourceQuestId: source._id },
    });

    return NextResponse.json({
      success: true,
      message: `Quest successfully duplicated as draft: "${duplicatedQuest.title}".`,
      data: duplicatedQuest,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const quest = await Quest.findById(id);
    if (!quest) {
      return NextResponse.json({ success: false, error: "Quest not found." }, { status: 404 });
    }

    const progressCount = await Investigation.countDocuments({ questId: quest._id });
    const isReferencedOrActive = progressCount > 0 || quest.currentCompletions > 0 || quest.status !== "DRAFT";

    if (isReferencedOrActive) {
      quest.status = "ARCHIVED";
      quest.isArchived = true;
      if (!quest.revisions) quest.revisions = [];
      quest.revisions.push({
        editedBy: user._id,
        editedByName: user.displayName,
        note: `Archived quest via delete request (active or completed by ${progressCount} users).`,
        timestamp: new Date(),
      });
      await quest.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "QUEST_ARCHIVED",
        targetType: "QUEST",
        targetId: quest._id,
        targetLabel: quest.title,
        reason: `Quest has ${progressCount} student completions; archived instead of hard-deleted.`,
        beforeState: { status: quest.status, isArchived: false },
        afterState: { status: "ARCHIVED", isArchived: true },
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Quest "${quest.title}" has active student progress; safely archived instead of hard deleted.`,
        data: { questId: quest._id, status: "ARCHIVED" },
      });
    }

    // Safe to hard delete unstarted draft
    await Clue.deleteMany({ questId: quest._id });
    await Quest.findByIdAndDelete(quest._id);

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "QUEST_DELETED",
      targetType: "QUEST",
      targetId: quest._id,
      targetLabel: quest.title,
      reason: `Permanently deleted unused draft quest "${quest.title}".`,
      beforeState: { questCode: quest.questCode, title: quest.title },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Unused draft quest "${quest.title}" permanently removed.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


