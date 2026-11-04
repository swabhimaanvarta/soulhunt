import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { User, LostItem, FoundItem, ClaimRequest, UserAchievement, Squad, Reward } from "@/models";
import { logAuditEvent } from "@/lib/audit";
import { isStarterCosmetic, isCosmeticOwned } from "@/lib/cosmetics";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const targetUsername = searchParams.get("username")?.trim().toLowerCase();

    let targetUser: any = null;

    if (targetUsername) {
      targetUser = await User.findOne({ username: targetUsername });
    } else if (currentUser) {
      targetUser = await User.findById(currentUser._id);
    }

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { code: "USER_NOT_FOUND", message: "Investigator profile not found." } },
        { status: 404 }
      );
    }

    const isOwnProfile = currentUser?._id && currentUser._id.toString() === targetUser._id.toString();
    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MODERATOR";

    // Privacy check: If user made profile private, return strictly masked handle and avatar to non-owners/non-staff
    if (!isOwnProfile && !isAdmin && targetUser.isProfilePublic === false) {
      const isAnon = targetUser.identityMode === "ANONYMOUS";
      // Private profiles MUST return masked handle only (@username or Anonymous Hunter), never real displayName
      const maskedDisplayName = isAnon ? "Anonymous Hunter" : `@${targetUser.username}`;

      const avatarPreset = isAnon ? "recon" : (targetUser.avatarPreset || "recon");
      const avatarUrl = isAnon
        ? "/avatars/recon.png"
        : (targetUser.avatarUrl || `/avatars/${avatarPreset}.png`);

      return NextResponse.json({
        success: true,
        isOwnProfile: false,
        profileHidden: true,
        message: "This hunter's profile is set to private.",
        profile: {
          username: targetUser.username,
          displayName: maskedDisplayName,
          avatar: avatarUrl,
          avatarUrl: avatarUrl,
          avatarPreset: avatarPreset,
          isProfilePublic: false,
        },
        activities: {
          lostItems: [],
          foundItems: [],
          claims: [],
          achievements: [],
        },
      });
    }

    // Squad details
    let squad = null;
    if (targetUser.squadId) {
      squad = await Squad.findById(targetUser.squadId)
        .select("name tag description emblemIcon squadLevel squadXp memberCap")
        .lean();
    }

    // Personal report history: Only exposed to profile owner or staff
    // Privacy invariant: Coarse campus location only, fine-grained spotDetails and internal notes stripped
    let lostItems: any[] = [];
    let foundItems: any[] = [];
    let claims: any[] = [];

    if (isOwnProfile || isAdmin) {
      lostItems = await LostItem.find({ reporterId: targetUser._id })
        .populate("lastKnownLocationId", "name code")
        .select("title category status lostAt photos createdAt lastKnownLocationId")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      foundItems = await FoundItem.find({ finderId: targetUser._id })
        .populate("foundLocationId", "name code")
        .populate("currentCustodyLocationId", "name code isSafeDesk")
        .select("shortTitle title category custodyStatus status foundAt blurredPhotoUrl createdAt foundLocationId currentCustodyLocationId")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      claims = await ClaimRequest.find({ claimantId: targetUser._id })
        .populate("itemId", "title shortTitle category status")
        .select("itemType itemId status createdAt verifiedAt rejectionReason")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    // Achievements: owner gets unlocked + in-progress; visitor gets unlocked only
    const achievementFilter: any = { userId: targetUser._id };
    if (!isOwnProfile && !isAdmin) {
      achievementFilter.isUnlocked = true;
    }
    const userAchievements = await UserAchievement.find(achievementFilter)
      .populate("achievementId")
      .sort({ isUnlocked: -1, unlockedAt: -1, progress: -1 })
      .limit(50)
      .lean();

    // Invariant: Non-owner public display name and avatar resolves by identityMode
    const isAnon = targetUser.identityMode === "ANONYMOUS";
    const isPublic = targetUser.identityMode === "PUBLIC";

    const resolvedDisplayName =
      isOwnProfile || isAdmin
        ? targetUser.displayName
        : isPublic
        ? targetUser.displayName
        : isAnon
        ? "Anonymous Hunter"
        : `@${targetUser.username}`;

    const resolvedAvatarPreset =
      !isOwnProfile && !isAdmin && isAnon
        ? "recon"
        : (targetUser.avatarPreset || "recon");

    const resolvedAvatarUrl =
      !isOwnProfile && !isAdmin && isAnon
        ? "/avatars/recon.png"
        : (targetUser.avatarUrl || `/avatars/${resolvedAvatarPreset}.png`);

    // Invariant: Leaderboard privacy controls level, xp, and rankTitle visibility
    const isLeaderboardPublic = targetUser.isLeaderboardPublic !== false;
    const canSeeLeaderboard = isOwnProfile || isAdmin || isLeaderboardPublic;

    // Invariant: Aggregated coarse counts from stats ONLY IF both isProfilePublic and isLeaderboardPublic
    let stats: Record<string, any> = {};
    if (isOwnProfile || isAdmin) {
      stats = targetUser.stats || {};
    } else if (targetUser.isProfilePublic !== false && isLeaderboardPublic) {
      stats = {
        recoveriesCount: targetUser.stats?.recoveriesCount || 0,
        safeDeskDepositsCount: targetUser.stats?.safeDeskDepositsCount || 0,
        questsCompleted: targetUser.stats?.questsCompleted || 0,
        cluesSolved: targetUser.stats?.cluesSolved || 0,
      };
    } else {
      stats = {};
    }

    const profileData: any = {
      _id: targetUser._id.toString(),
      username: targetUser.username,
      displayName: resolvedDisplayName,
      avatarUrl: resolvedAvatarUrl,
      avatarPreset: resolvedAvatarPreset,
      bio: targetUser.bio || "",
      department: targetUser.department || "Engineering",
      yearOfStudy: targetUser.yearOfStudy || 1,
      rankTitle: canSeeLeaderboard ? (targetUser.rankTitle || "Campus Seeker") : "Unranked Operative",
      ...(canSeeLeaderboard
        ? {
            level: targetUser.level ?? 1,
            xp: targetUser.xp ?? 0,
            trophies: targetUser.trophies ?? targetUser.weeklyScore ?? 0,
            weeklyScore: targetUser.weeklyScore ?? 0,
          }
        : {}),
      equippedTitle: targetUser.equippedTitle || "",
      equippedFrame: targetUser.equippedFrame || "frame-emerald-pulse",
      equippedTheme: targetUser.equippedTheme || "theme-obsidian-grid",
      equippedEffect: targetUser.equippedEffect || "",
      stats,
      squad,
      createdAt: targetUser.createdAt,
      isProfilePublic: targetUser.isProfilePublic !== false,
      isLeaderboardPublic,
      identityMode: targetUser.identityMode || "PSEUDONYMOUS",
      publicAttributionPreference: targetUser.publicAttributionPreference || "HANDLE",
      featuredAchievementIds: targetUser.featuredAchievementIds || [],
      // Private fields and internal trust signals strictly exposed to owner or admin ONLY
      ...(isOwnProfile || isAdmin
        ? {
            role: targetUser.role,
            trustTier: targetUser.trustTier,
            trustScore: targetUser.trustScore,
            email: targetUser.email,
            phoneNumber: targetUser.phoneNumber || "",
            studentId: targetUser.studentId || "",
            preferredContactMethod: targetUser.preferredContactMethod || "SAFE_DESK",
            coins: targetUser.coins,
          }
        : {}),
    };

    return NextResponse.json({
      success: true,
      isOwnProfile,
      profile: profileData,
      activities: {
        lostItems,
        foundItems,
        claims,
        achievements: userAchievements,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to edit your profile." } },
        { status: 401 }
      );
    }

    await connectDB();
    const body = await req.json();

    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User account not found." } },
        { status: 404 }
      );
    }

    const previousState = {
      displayName: user.displayName,
      bio: user.bio,
      department: user.department,
      yearOfStudy: user.yearOfStudy,
      phoneNumber: user.phoneNumber,
      studentId: user.studentId,
      preferredContactMethod: user.preferredContactMethod,
      avatarPreset: user.avatarPreset,
    };

    // Validations & updates
    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (name.length < 2 || name.length > 50) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_INPUT", message: "Display name must be between 2 and 50 characters." } },
          { status: 400 }
        );
      }
      user.displayName = name;
    }

    if (body.bio !== undefined) {
      const bioText = String(body.bio).trim();
      if (bioText.length > 300) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_INPUT", message: "Bio cannot exceed 300 characters." } },
          { status: 400 }
        );
      }
      user.bio = bioText;
    }

    if (body.department !== undefined) {
      user.department = String(body.department).trim().slice(0, 100);
    }

    if (body.yearOfStudy !== undefined) {
      const year = Number(body.yearOfStudy);
      if (year >= 1 && year <= 5) {
        user.yearOfStudy = year;
      }
    }

    if (body.studentId !== undefined) {
      user.studentId = String(body.studentId).trim().toUpperCase().slice(0, 30);
    }

    if (body.phoneNumber !== undefined) {
      user.phoneNumber = String(body.phoneNumber).trim().slice(0, 25);
    }

    if (body.preferredContactMethod !== undefined) {
      if (["EMAIL", "PHONE", "SAFE_DESK"].includes(body.preferredContactMethod)) {
        user.preferredContactMethod = body.preferredContactMethod;
      }
    }

    const BUILTIN_AVATAR_PRESETS = [
      "recon",
      "scout",
      "infiltrator",
      "tactician",
      "sleuth",
      "vanguard",
      "sentinel",
      "shadow",
      "archivist",
    ];
    if (body.avatarPreset !== undefined) {
      const preset = String(body.avatarPreset).trim().toLowerCase();
      if (!BUILTIN_AVATAR_PRESETS.includes(preset)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_AVATAR_PRESET",
              message: `Invalid avatar preset '${preset}'. Must be one of built-in presets: ${BUILTIN_AVATAR_PRESETS.join(", ")}. Custom file uploads are not supported.`,
            },
          },
          { status: 400 }
        );
      }
      user.avatarPreset = preset;
      user.avatarUrl = `/avatars/${preset}.png`;
    }

    if (body.avatarUrl !== undefined) {
      const urlStr = String(body.avatarUrl).trim();
      const isPresetUrl = BUILTIN_AVATAR_PRESETS.some((p) => urlStr === `/avatars/${p}.png`);
      if (!isPresetUrl && urlStr !== "/avatars/default-hunter.png") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CUSTOM_AVATAR_PROHIBITED",
              message: "Custom avatar file uploads and external image URLs are prohibited. Avatar customization is restricted to built-in presets only.",
            },
          },
          { status: 400 }
        );
      }
      user.avatarUrl = urlStr;
    }

    // Cosmetic Equip Ownership Validation
    const hasCosmeticEquip =
      body.equippedTitle !== undefined ||
      body.equippedFrame !== undefined ||
      body.equippedTheme !== undefined ||
      body.equippedBanner !== undefined ||
      body.equippedEffect !== undefined ||
      body.equippedDecoration !== undefined;

    let ownedRewards: any[] = [];
    if (hasCosmeticEquip && Array.isArray(user.ownedCosmetics) && user.ownedCosmetics.length > 0) {
      const validRewardIds = user.ownedCosmetics.filter((id: any) => {
        const idStr = id?.toString ? id.toString() : String(id);
        return /^[0-9a-fA-F]{24}$/.test(idStr);
      });
      if (validRewardIds.length > 0) {
        ownedRewards = await Reward.find({ _id: { $in: validRewardIds } }).lean();
      }
    }

    const isCosmeticEligible = (val: string): boolean => {
      const cleanVal = String(val).trim();
      if (!cleanVal) return true;

      // a) Starter cosmetics: zero paywall, always allowed
      if (isStarterCosmetic(cleanVal)) return true;

      // b) Present in user.ownedCosmetics (matching by string id or Reward ObjectId)
      if (
        user.ownedCosmetics?.some((id: any) => {
          const idStr = id?.toString ? id.toString() : String(id);
          return idStr === cleanVal || idStr.toLowerCase() === cleanVal.toLowerCase();
        })
      ) {
        return true;
      }

      // c) Matching Reward in user's owned rewards (by ObjectId, code, title, name, metadata.value)
      if (
        ownedRewards.some((r: any) => {
          const rId = r._id?.toString() || "";
          const rVal = r.metadata?.value || "";
          const rCode = r.code || "";
          const rTitle = r.title || "";
          const rName = r.name || "";
          return (
            rId === cleanVal ||
            (rVal && rVal.toLowerCase() === cleanVal.toLowerCase()) ||
            (rCode && rCode.toLowerCase() === cleanVal.toLowerCase()) ||
            (rTitle && rTitle.toLowerCase() === cleanVal.toLowerCase()) ||
            (rName && rName.toLowerCase() === cleanVal.toLowerCase())
          );
        })
      ) {
        return true;
      }

      // d) Level / achievement unlocked in catalogue
      if (isCosmeticOwned(user, cleanVal, user.level)) {
        return true;
      }

      return false;
    };

    if (body.equippedTitle !== undefined) {
      const titleVal = String(body.equippedTitle).trim();
      if (!isCosmeticEligible(titleVal)) {
        return NextResponse.json(
          { success: false, error: "COSMETIC_NOT_OWNED", message: "Cannot equip an unowned cosmetic item." },
          { status: 403 }
        );
      }
      user.equippedTitle = titleVal.slice(0, 60);
    }

    if (body.equippedFrame !== undefined) {
      const frameVal = String(body.equippedFrame).trim();
      if (!isCosmeticEligible(frameVal)) {
        return NextResponse.json(
          { success: false, error: "COSMETIC_NOT_OWNED", message: "Cannot equip an unowned cosmetic item." },
          { status: 403 }
        );
      }
      const matchedReward = ownedRewards.find((r: any) => r._id?.toString() === frameVal);
      user.equippedFrame = (matchedReward?.metadata?.value || frameVal).slice(0, 80);
    }

    if (body.equippedTheme !== undefined) {
      const themeVal = String(body.equippedTheme).trim();
      if (!isCosmeticEligible(themeVal)) {
        return NextResponse.json(
          { success: false, error: "COSMETIC_NOT_OWNED", message: "Cannot equip an unowned cosmetic item." },
          { status: 403 }
        );
      }
      const matchedReward = ownedRewards.find((r: any) => r._id?.toString() === themeVal);
      user.equippedTheme = (matchedReward?.metadata?.value || themeVal).slice(0, 80);
    }

    if (body.equippedBanner !== undefined) {
      const bannerVal = String(body.equippedBanner).trim();
      if (!isCosmeticEligible(bannerVal)) {
        return NextResponse.json(
          { success: false, error: "COSMETIC_NOT_OWNED", message: "Cannot equip an unowned cosmetic item." },
          { status: 403 }
        );
      }
    }

    if (body.equippedDecoration !== undefined) {
      const decorVal = String(body.equippedDecoration).trim();
      if (!isCosmeticEligible(decorVal)) {
        return NextResponse.json(
          { success: false, error: "COSMETIC_NOT_OWNED", message: "Cannot equip an unowned cosmetic item." },
          { status: 403 }
        );
      }
    }

    if (body.equippedEffect !== undefined) {
      const effectVal = String(body.equippedEffect).trim();
      if (effectVal && !isCosmeticEligible(effectVal)) {
        return NextResponse.json(
          { success: false, error: "COSMETIC_NOT_OWNED", message: "Cannot equip an unowned cosmetic item." },
          { status: 403 }
        );
      }
      user.equippedEffect = effectVal.slice(0, 80);
    }

    if (body.isProfilePublic !== undefined) {
      user.isProfilePublic = Boolean(body.isProfilePublic);
    }

    if (body.isLeaderboardPublic !== undefined) {
      user.isLeaderboardPublic = Boolean(body.isLeaderboardPublic);
    }

    if (body.identityMode !== undefined && ["PSEUDONYMOUS", "ANONYMOUS", "PUBLIC"].includes(body.identityMode)) {
      user.identityMode = body.identityMode;
    }

    if (body.publicAttributionPreference !== undefined && ["HANDLE", "ANONYMOUS"].includes(body.publicAttributionPreference)) {
      user.publicAttributionPreference = body.publicAttributionPreference;
    }

    if (Array.isArray(body.featuredAchievementIds)) {
      user.featuredAchievementIds = body.featuredAchievementIds
        .filter((id: any) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id))
        .slice(0, 3);
    }

    // Normalize legacy trust tier if present
    if ((user as any).trustTier === "TRUSTED_RECOVERER") {
      user.trustTier = "TRUSTED_HUNTER";
    }

    await user.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "USER_EDITED",
      targetType: "USER",
      targetId: user._id,
      targetLabel: `@${user.username}`,
      reason: "User self-updated their investigator profile details.",
      beforeState: previousState,
      afterState: {
        displayName: user.displayName,
        bio: user.bio,
        department: user.department,
        yearOfStudy: user.yearOfStudy,
        phoneNumber: user.phoneNumber,
        studentId: user.studentId,
        preferredContactMethod: user.preferredContactMethod,
        avatarPreset: user.avatarPreset,
        isProfilePublic: user.isProfilePublic,
        isLeaderboardPublic: user.isLeaderboardPublic,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        avatarPreset: user.avatarPreset,
        bio: user.bio,
        department: user.department,
        yearOfStudy: user.yearOfStudy,
        studentId: user.studentId,
        phoneNumber: user.phoneNumber,
        preferredContactMethod: user.preferredContactMethod,
        equippedTitle: user.equippedTitle,
        equippedFrame: user.equippedFrame,
        equippedTheme: user.equippedTheme,
        equippedEffect: user.equippedEffect || "",
        level: user.level,
        rankTitle: user.rankTitle,
        coins: user.coins,
        xp: user.xp,
        trustScore: user.trustScore,
        trustTier: user.trustTier,
        isProfilePublic: user.isProfilePublic !== false,
        isLeaderboardPublic: user.isLeaderboardPublic !== false,
        identityMode: user.identityMode || "PSEUDONYMOUS",
        publicAttributionPreference: user.publicAttributionPreference || "HANDLE",
        featuredAchievementIds: user.featuredAchievementIds || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

