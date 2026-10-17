import React from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Investigation, Quest, Clue, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import InvestigationRoomClient from "@/components/InvestigationRoomClient";

export default async function SquadInvestigationRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectDB();

  const investigation = await Investigation.findById(id).lean();
  if (!investigation) return notFound();

  const [quest, clues, squad, currentUser] = await Promise.all([
    Quest.findById(investigation.questId).populate("targetLocationId").lean(),
    Clue.find({ questId: investigation.questId }).select("-expectedAnswerNormalized").sort({ stageOrder: 1 }).lean(),
    investigation.squadId ? Squad.findById(investigation.squadId).lean() : null,
    getCurrentUser(),
  ]);

  if (!quest) return notFound();

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <InvestigationRoomClient
          initialInvestigation={JSON.parse(JSON.stringify(investigation))}
          quest={JSON.parse(JSON.stringify(quest))}
          initialClues={JSON.parse(JSON.stringify(clues))}
          squad={squad ? JSON.parse(JSON.stringify(squad)) : null}
          currentUser={currentUser ? JSON.parse(JSON.stringify(currentUser)) : null}
        />
      </div>
    </div>
  );
}
