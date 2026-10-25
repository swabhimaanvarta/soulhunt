import { connectDB } from "../lib/db";
import { Squad, SquadMember, User } from "../models";

export interface SquadMigrationReport {
  totalSquads: number;
  totalMembers: number;
  migratedOfficers: number;
  confirmedLeaders: number;
  membersRetained: number;
  conflicts: {
    squadId: string;
    squadName: string;
    reason: string;
    leaderIdFromSquad: string;
    leaderMemberIds: string[];
  }[];
  dryRun: boolean;
}

export async function runSquadRoleMigration(dryRun: boolean = true): Promise<SquadMigrationReport> {
  await connectDB();

  console.log(`\n======================================================`);
  console.log(`🛡️  AIEM HUNT — SQUAD ROLE MIGRATION (DryRun: ${dryRun})`);
  console.log(`======================================================\n`);

  const squads = await Squad.find().lean();
  const members = await SquadMember.find().lean();

  const report: SquadMigrationReport = {
    totalSquads: squads.length,
    totalMembers: members.length,
    migratedOfficers: 0,
    confirmedLeaders: 0,
    membersRetained: 0,
    conflicts: [],
    dryRun,
  };

  // Group members by squad
  const membersBySquad = new Map<string, any[]>();
  for (const m of members) {
    const sqId = m.squadId.toString();
    if (!membersBySquad.has(sqId)) membersBySquad.set(sqId, []);
    membersBySquad.get(sqId)!.push(m);
  }

  // 1. Conflict detection & verification
  for (const squad of squads) {
    const sqId = squad._id.toString();
    const squadMembers = membersBySquad.get(sqId) || [];
    const leaderRowCandidates = squadMembers.filter(
      (m) => m.role === "LEADER" || m.squadRole === "LEADER"
    );

    if (leaderRowCandidates.length === 0) {
      if (squad.leaderId) {
        const leaderUser = await User.findById(squad.leaderId);
        if (leaderUser) {
          if (!dryRun) {
            await SquadMember.create({
              squadId: squad._id,
              userId: squad.leaderId,
              role: "LEADER",
              squadRole: "LEADER",
              joinedAt: squad.createdAt || new Date(),
              contributedSquadXp: 0,
            });
            const squadUsers = await User.find({ squadId: squad._id, _id: { $ne: squad.leaderId } });
            for (const su of squadUsers) {
              const existing = await SquadMember.findOne({ squadId: squad._id, userId: su._id });
              if (!existing) {
                await SquadMember.create({
                  squadId: squad._id,
                  userId: su._id,
                  role: "MEMBER",
                  squadRole: "MEMBER",
                  joinedAt: su.createdAt || new Date(),
                  contributedSquadXp: 0,
                });
                report.membersRetained++;
              }
            }
          }
          report.confirmedLeaders++;
          continue;
        }
      }

      report.conflicts.push({
        squadId: sqId,
        squadName: squad.name,
        reason: "NO_LEADER_ROW: Squad has no member record with role LEADER and no valid leaderId user",
        leaderIdFromSquad: squad.leaderId?.toString() || "null",
        leaderMemberIds: [],
      });
      continue;
    }

    if (leaderRowCandidates.length > 1) {
      report.conflicts.push({
        squadId: sqId,
        squadName: squad.name,
        reason: `MULTIPLE_LEADER_ROWS: Found ${leaderRowCandidates.length} leader rows in squad`,
        leaderIdFromSquad: squad.leaderId?.toString() || "null",
        leaderMemberIds: leaderRowCandidates.map((m) => m.userId.toString()),
      });
      continue;
    }

    // Single leader row found. Check if it matches squad.leaderId
    const soleLeaderMember = leaderRowCandidates[0];
    if (squad.leaderId && soleLeaderMember.userId.toString() !== squad.leaderId.toString()) {
      report.conflicts.push({
        squadId: sqId,
        squadName: squad.name,
        reason: "MISMATCHED_LEADER_ID: Member role LEADER userId does not match squad.leaderId",
        leaderIdFromSquad: squad.leaderId.toString(),
        leaderMemberIds: [soleLeaderMember.userId.toString()],
      });
      continue;
    }

    report.confirmedLeaders++;
  }

  // If there are conflicts, stop and emit report for manual resolution as strictly demanded!
  if (report.conflicts.length > 0) {
    console.warn(`⚠️  MIGRATION STOPPED: ${report.conflicts.length} conflicting squad(s) detected.`);
    for (const c of report.conflicts) {
      console.warn(`  - [${c.squadName} (${c.squadId})]: ${c.reason}`);
    }
    console.warn(`Aborting execution to prevent silent corruption. Please resolve conflicts manually.\n`);
    return report;
  }

  // 2. Perform migration (or dry run simulation)
  for (const m of members) {
    const currentRole = (m.role || m.squadRole || "MEMBER").toUpperCase();

    if (currentRole === "OFFICER") {
      report.migratedOfficers++;
      if (!dryRun) {
        await SquadMember.updateOne(
          { _id: m._id },
          { $set: { role: "COLEADER", squadRole: "COLEADER" } }
        );
      }
    } else if (currentRole === "LEADER") {
      if (!dryRun) {
        await SquadMember.updateOne(
          { _id: m._id },
          { $set: { role: "LEADER", squadRole: "LEADER" } }
        );
      }
    } else {
      report.membersRetained++;
      if (!dryRun) {
        const targetRole = currentRole === "ELDER" ? "ELDER" : "MEMBER";
        await SquadMember.updateOne(
          { _id: m._id },
          { $set: { role: targetRole, squadRole: targetRole } }
        );
      }
    }
  }

  console.log(`✅ SQUAD ROLE MIGRATION ${dryRun ? "SIMULATION COMPLETE (DRY-RUN)" : "SUCCESSFULLY APPLIED"}:`);
  console.log(`   Total Squads: ${report.totalSquads}`);
  console.log(`   Confirmed Leaders: ${report.confirmedLeaders}`);
  console.log(`   Migrated Officers -> CoLeaders: ${report.migratedOfficers}`);
  console.log(`   Retained Members: ${report.membersRetained}`);
  console.log(`   Conflicts: 0\n`);

  return report;
}

// Allow direct CLI invocation
if (require.main === module) {
  const isApply = process.argv.includes("--apply");
  runSquadRoleMigration(!isApply)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
