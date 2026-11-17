import React from "react";
import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Investigation, Quest, Clue, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import InvestigationRoomClient from "@/components/InvestigationRoomClient";
import { createPlayerClueVariants } from "@/lib/game/variants";

export default async function SquadInvestigationRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectDB();

  let investigationDoc = await Investigation.findById(id);
  if (!investigationDoc) return notFound();

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const callerId = currentUser._id.toString();
  const isOwner = investigationDoc.userId?.toString() === callerId;
  const isSquadMember = Boolean(
    investigationDoc.squadId &&
    currentUser.squadId &&
    investigationDoc.squadId.toString() === currentUser.squadId.toString()
  );
  const isParticipant =
    isOwner ||
    isSquadMember ||
    (Array.isArray(investigationDoc.participatingUserIds) &&
      investigationDoc.participatingUserIds.some((p: any) => p.toString() === callerId)) ||
    currentUser.role === "ADMIN" ||
    currentUser.role === "MODERATOR";

  if (!isParticipant) {
    return notFound();
  }

  const isCompleted = ["COMPLETED", "READY_FOR_RECOVERY", "SUBMITTED_FOR_VERIFICATION"].includes(
    investigationDoc.status
  );

  const [quest, rawClues, squad] = await Promise.all([
    Quest.findById(investigationDoc.questId).populate("targetLocationId").lean(),
    Clue.find({ questId: investigationDoc.questId })
      .select("-expectedAnswerNormalized -correctOptionId -acceptableAnswers -explanation")
      .sort({ stageOrder: 1 })
      .lean(),
    investigationDoc.squadId ? Squad.findById(investigationDoc.squadId).lean() : null,
  ]);

  if (!quest) return notFound();

  // If this investigation lacks player-specific variants (e.g. legacy/pre-existing), generate and save them now
  if (!investigationDoc.stageVariants || investigationDoc.stageVariants.length === 0) {
    const fullClues = await Clue.find({ questId: quest._id })
      .select("+expectedAnswerNormalized +correctOptionId")
      .sort({ stageOrder: 1 })
      .lean();
    const effectiveUserId = investigationDoc.userId || currentUser._id || investigationDoc._id;
    investigationDoc.stageVariants = createPlayerClueVariants(fullClues, effectiveUserId);
    await investigationDoc.save();
  }

  const investigation = investigationDoc.toObject();

  if (!isCompleted && Array.isArray(investigation.stageVariants)) {
    investigation.stageVariants = investigation.stageVariants.map((v: any) => {
      const { customExpectedAnswer, acceptableAnswers, explanation, ...safeVariant } = v;
      return safeVariant;
    });
  }

  // Reveal ONLY the player's current stage and previously solved stages.
  // Conceal future stages completely from client network payload.
  const maxAllowedStage = isCompleted ? 999 : (investigation.currentStage || 1);

  const personalizedClues = rawClues
    .filter((c: any) => c.stageOrder <= maxAllowedStage)
    .map((c: any) => {
      const variant = investigationDoc.stageVariants?.find((v: any) => v.stageOrder === c.stageOrder);
      const safeClue: any = {
        ...c,
        clueText: variant?.customClueText || c.clueText,
        options: variant?.options && variant.options.length > 0 ? variant.options : (c.options || []),
      };
      if (!isCompleted) {
        delete safeClue.expectedAnswerNormalized;
        delete safeClue.correctOptionId;
        delete safeClue.acceptableAnswers;
        delete safeClue.explanation;
        if (safeClue.variantTemplate) {
          const { formula, explanationTemplate, ...safeTpl } = safeClue.variantTemplate;
          safeClue.variantTemplate = safeTpl;
        }
      }
      return safeClue;
    });

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <InvestigationRoomClient
          initialInvestigation={JSON.parse(JSON.stringify(investigation))}
          quest={JSON.parse(JSON.stringify(quest))}
          initialClues={JSON.parse(JSON.stringify(personalizedClues))}
          squad={squad ? JSON.parse(JSON.stringify(squad)) : null}
          currentUser={JSON.parse(JSON.stringify(currentUser))}
        />
      </div>
    </div>
  );
}
