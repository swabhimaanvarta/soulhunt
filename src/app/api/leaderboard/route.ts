import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Squad, SquadMember } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "HUNTERS"; // HUNTERS | SQUADS
    const timeframe = searchParams.get("timeframe") || "ALL_TIME"; // ALL_TIME | WEEKLY
    const department = searchParams.get("department");

    if (category === "SQUADS") {
      const sortCriteria: any =
        timeframe === "WEEKLY"
          ? { weeklyScore: -1, squadXp: -1, createdAt: 1, _id: 1 }
          : { squadXp: -1, completedHuntsCount: -1, createdAt: 1, _id: 1 };

      const topSquads = await Squad.find()
        .populate("leaderId", "displayName username avatarUrl")
        .sort(sortCriteria)
        .limit(25)
        .lean();

      // Compute dynamic real member count and project memberCap (default 8, NOT 50!)
      const squadIds = topSquads.map((s) => s._id);
      const memberCounts = await SquadMember.aggregate([
        { $match: { squadId: { $in: squadIds } } },
        { $group: { _id: "$squadId", count: { $sum: 1 } } },
      ]);
      const memberCountMap = new Map(
        memberCounts.map((m) => [m._id.toString(), m.count])
      );

      const squadsWithCounts = topSquads.map((squad: any) => {
        let leader = squad.leaderId;
        if (leader && typeof leader === "object" && leader.username) {
          const leaderMode = leader.identityMode || "PSEUDONYMOUS";
          let leaderDisplayName = leader.displayName;
          let leaderAvatar = leader.avatarUrl || "/avatars/recon.png";
          if (leaderMode === "ANONYMOUS") {
            leaderDisplayName = "Anonymous Hunter";
            leaderAvatar = "/avatars/recon.png";
          } else if (leaderMode === "PSEUDONYMOUS") {
            leaderDisplayName = `@${leader.username}`;
          }
          leader = {
            _id: leader._id?.toString(),
            username: leader.username,
            displayName: leaderDisplayName,
            avatarUrl: leaderAvatar,
          };
        }
        return {
          ...squad,
          leaderId: leader,
          memberCount: memberCountMap.get(squad._id.toString()) || 1,
          memberCap: squad.memberCap ?? 8,
        };
      });

      let viewerSquadPosition = null;
      if (currentUser?.squadId) {
        const userSquad = await Squad.findById(currentUser.squadId).lean();
        if (userSquad) {
          const squadCreatedAt = userSquad.createdAt || new Date(0);
          const higherCount = await Squad.countDocuments({
            ...(timeframe === "WEEKLY"
              ? {
                  $or: [
                    { weeklyScore: { $gt: userSquad.weeklyScore || 0 } },
                    { weeklyScore: userSquad.weeklyScore || 0, squadXp: { $gt: userSquad.squadXp || 0 } },
                    { weeklyScore: userSquad.weeklyScore || 0, squadXp: userSquad.squadXp || 0, createdAt: { $lt: squadCreatedAt } },
                    { weeklyScore: userSquad.weeklyScore || 0, squadXp: userSquad.squadXp || 0, createdAt: squadCreatedAt, _id: { $lt: userSquad._id } },
                  ],
                }
              : {
                  $or: [
                    { squadXp: { $gt: userSquad.squadXp || 0 } },
                    { squadXp: userSquad.squadXp || 0, completedHuntsCount: { $gt: userSquad.completedHuntsCount || 0 } },
                    { squadXp: userSquad.squadXp || 0, completedHuntsCount: userSquad.completedHuntsCount || 0, createdAt: { $lt: squadCreatedAt } },
                    { squadXp: userSquad.squadXp || 0, completedHuntsCount: userSquad.completedHuntsCount || 0, createdAt: squadCreatedAt, _id: { $lt: userSquad._id } },
                  ],
                }),
          });
          const totalSquads = await Squad.countDocuments();
          const squadMemberCount = await SquadMember.countDocuments({ squadId: userSquad._id });
          const rank = higherCount + 1;
          const percentile = totalSquads > 0 ? Math.max(1, Math.round((rank / totalSquads) * 100)) : 1;

          viewerSquadPosition = {
            squadId: userSquad._id.toString(),
            name: userSquad.name,
            tag: userSquad.tag,
            rank,
            squadXp: userSquad.squadXp,
            weeklyScore: userSquad.weeklyScore || 0,
            memberCount: squadMemberCount || 1,
            memberCap: userSquad.memberCap ?? 8,
            percentile,
            totalSquads,
          };
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          squads: squadsWithCounts,
          viewerSquadPosition,
        },
      });
    }

    // Category: HUNTERS (Operatives)
    // Deterministic sort: score desc, then xp desc, then level desc, then createdAt asc, then _id asc
    // Strictly omit internal moderation signals (DO NOT expose trustTier or trustScore)
    // Enforce server-side identityMode masking:
    //   PSEUDONYMOUS: displayName resolves to `@${u.username}`
    //   ANONYMOUS: displayName resolves to 'Anonymous Hunter' & avatarPreset defaults to 'recon'
    //   PUBLIC: full displayName
    const hunterSort: any =
      timeframe === "WEEKLY"
        ? { weeklyScore: -1, xp: -1, level: -1, createdAt: 1, _id: 1 }
        : { xp: -1, level: -1, createdAt: 1, _id: 1 };

    const filter: any = {
      accountStatus: "ACTIVE",
      isLeaderboardPublic: { $ne: false },
    };

    if (department && department !== "ALL" && department !== "All Departments") {
      filter.department = department;
    }

    const topHunters = await User.find(filter)
      .select("displayName username avatarPreset avatarUrl level rankTitle xp weeklyScore trophies identityMode stats.recoveriesCount stats.questsCompleted department equippedTitle equippedFrame equippedTheme squadId createdAt")
      .populate("squadId", "name tag emblemIcon")
      .sort(hunterSort)
      .limit(30)
      .lean();

    const maskedHunters = topHunters.map((u: any) => {
      const mode = u.identityMode || "PSEUDONYMOUS";
      let displayName = u.displayName;
      let avatarPreset = u.avatarPreset || "recon";
      let avatarUrl = u.avatarUrl || `/avatars/${avatarPreset}.png`;

      if (mode === "ANONYMOUS") {
        displayName = "Anonymous Hunter";
        avatarPreset = "recon";
        avatarUrl = "/avatars/recon.png";
      } else if (mode === "PUBLIC") {
        displayName = u.displayName || `@${u.username}`;
      } else {
        // PSEUDONYMOUS (default)
        displayName = `@${u.username}`;
      }

      return {
        _id: u._id.toString(),
        username: u.username,
        displayName,
        identityMode: mode,
        avatarPreset,
        avatarUrl,
        equippedTitle: u.equippedTitle || "Campus Pathfinder",
        equippedFrame: u.equippedFrame || "frame-emerald-pulse",
        equippedTheme: u.equippedTheme || "theme-obsidian-grid",
        department: u.department || "Computer Engineering",
        level: u.level || 1,
        rankTitle: u.rankTitle || "Rookie Scout",
        xp: u.xp || 0,
        weeklyScore: u.weeklyScore || 0,
        trophies: u.trophies || u.weeklyScore || 0,
        stats: {
          recoveriesCount: u.stats?.recoveriesCount || 0,
          questsCompleted: u.stats?.questsCompleted || 0,
        },
        squadId: u.squadId && (u.squadId as any).name
          ? {
              _id: u.squadId._id?.toString(),
              name: u.squadId.name,
              tag: u.squadId.tag,
              emblemIcon: u.squadId.emblemIcon,
            }
          : null,
      };
    });

    let viewerPosition = null;
    if (currentUser) {
      const dbUser = await User.findById(currentUser._id)
        .select("username displayName avatarPreset equippedFrame equippedTitle xp level weeklyScore isLeaderboardPublic createdAt department")
        .lean();

      if (dbUser) {
        const baseFilter: any = {
          accountStatus: "ACTIVE",
          isLeaderboardPublic: { $ne: false },
        };
        const hasDeptFilter = Boolean(department && department !== "ALL" && department !== "All Departments");
        const isUserInFilteredDept = hasDeptFilter && dbUser.department === department;

        let rank: number | null = null;
        let departmentRank: number | null = null;
        let percentile: number | null = null;
        let totalUsers: number = 0;

        if (dbUser.isLeaderboardPublic !== false) {
          const userCreatedAt = dbUser.createdAt || new Date(0);
          const scoreQuery = (filterScope: any) => ({
            ...filterScope,
            ...(timeframe === "WEEKLY"
              ? {
                  $or: [
                    { weeklyScore: { $gt: dbUser.weeklyScore || 0 } },
                    { weeklyScore: dbUser.weeklyScore || 0, xp: { $gt: dbUser.xp || 0 } },
                    { weeklyScore: dbUser.weeklyScore || 0, xp: dbUser.xp || 0, level: { $gt: dbUser.level || 1 } },
                    { weeklyScore: dbUser.weeklyScore || 0, xp: dbUser.xp || 0, level: dbUser.level || 1, createdAt: { $lt: userCreatedAt } },
                    { weeklyScore: dbUser.weeklyScore || 0, xp: dbUser.xp || 0, level: dbUser.level || 1, createdAt: userCreatedAt, _id: { $lt: dbUser._id } },
                  ],
                }
              : {
                  $or: [
                    { xp: { $gt: dbUser.xp || 0 } },
                    { xp: dbUser.xp || 0, level: { $gt: dbUser.level || 1 } },
                    { xp: dbUser.xp || 0, level: dbUser.level || 1, createdAt: { $lt: userCreatedAt } },
                    { xp: dbUser.xp || 0, level: dbUser.level || 1, createdAt: userCreatedAt, _id: { $lt: dbUser._id } },
                  ],
                }),
          });

          // Calculate global rank
          const globalHigherCount = await User.countDocuments(scoreQuery(baseFilter));
          const totalGlobalUsers = await User.countDocuments(baseFilter);
          const globalRank = globalHigherCount + 1;

          if (isUserInFilteredDept) {
            // User belongs to filtered department
            const deptFilter = { ...baseFilter, department };
            const deptHigherCount = await User.countDocuments(scoreQuery(deptFilter));
            const totalDeptUsers = await User.countDocuments(deptFilter);
            departmentRank = deptHigherCount + 1;
            rank = departmentRank;
            totalUsers = totalDeptUsers;
            percentile = totalDeptUsers > 0 ? Math.max(1, Math.round((rank / totalDeptUsers) * 100)) : 1;
          } else {
            // Fallback to global rank when unranked in another department or no department filter
            rank = globalRank;
            totalUsers = totalGlobalUsers;
            percentile = totalGlobalUsers > 0 ? Math.max(1, Math.round((rank / totalGlobalUsers) * 100)) : 1;
          }
        } else {
          totalUsers = await User.countDocuments(baseFilter);
        }

        viewerPosition = {
          userId: dbUser._id.toString(),
          username: dbUser.username,
          displayName: dbUser.displayName,
          avatarPreset: dbUser.avatarPreset || "recon",
          equippedFrame: dbUser.equippedFrame || "frame-emerald-pulse",
          equippedTitle: dbUser.equippedTitle || "Campus Pathfinder",
          rank,
          departmentRank,
          xp: dbUser.xp,
          level: dbUser.level,
          weeklyScore: dbUser.weeklyScore || 0,
          trophies: dbUser.trophies || dbUser.weeklyScore || 0,
          isLeaderboardPublic: dbUser.isLeaderboardPublic !== false,
          percentile,
          totalUsers,
          department: dbUser.department,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        hunters: maskedHunters,
        viewerPosition,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
