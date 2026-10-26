import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { User, LostItem, FoundItem, ClaimRequest, UserAchievement, Squad } from "@/models";
import { logAuditEvent } from "@/lib/audit";

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
      return NextResponse.json({
        success: true,
        isOwnProfile: false,
        profileHidden: true,
        message: "This hunter's profile is set to private.",
        profile: {
          username: targetUser.username,
          displayName: targetUser.identityMode === "PUBLIC" ? targetUser.displayName : `@${targetUser.username}`,
          avatar: targetUser.avatarUrl || `/avatars/${targetUser.avatarPreset || "recon"}.png`,
          avatarUrl: targetUser.avatarUrl || `/avatars/${targetUser.avatarPreset || "recon"}.png`,
          avatarPreset: targetUser.avatarPreset || "recon",
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
    let lostItems: any[] = [];
    let foundItems: any[] = [];
    let claims: any[] = [];

    if (isOwnProfile || isAdmin) {
      lostItems = await LostItem.find({ reporterId: targetUser._id })
        .select("title category status lostAt spotDetails photos createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      foundItems = await FoundItem.find({ finderId: targetUser._id })
        .select("shortTitle title category custodyStatus status foundAt spotDetails blurredPhotoUrl createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      claims = await ClaimRequest.find({ claimantId: targetUser._id })
        .populate("itemId", "title shortTitle category status")
        .select("itemType itemId status createdAt verifiedAt rejectionReason")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // Unlocked achievements
    const userAchievements = await UserAchievement.find({ userId: targetUser._id, isUnlocked: true })
      .populate("achievementId")
      .sort({ unlockedAt: -1 })
      .limit(20)
      .lean();

    // Invariant: Non-owner public display name resolves by identityMode (PUBLIC vs PSEUDONYMOUS)
    const publicDisplayName =
      targetUser.identityMode === "PUBLIC" || isOwnProfile || isAdmin
        ? targetUser.displayName
        : `@${targetUser.username}`;

    const profileData = {
      _id: targetUser._id.toString(),
      username: targetUser.username,
      displayName: publicDisplayName,
      avatarUrl: targetUser.avatarUrl,
      avatarPreset: targetUser.avatarPreset || "recon",
      bio: targetUser.bio || "",
      department: targetUser.department || "Engineering",
      yearOfStudy: targetUser.yearOfStudy || 1,
      role: targetUser.role,
      level: targetUser.level,
      rankTitle: targetUser.rankTitle,
      xp: targetUser.xp,
      equippedTitle: targetUser.equippedTitle || "",
      equippedFrame: targetUser.equippedFrame || "frame-emerald-pulse",
      equippedTheme: targetUser.equippedTheme || "theme-obsidian-grid",
      stats: targetUser.stats || {},
      squad,
      createdAt: targetUser.createdAt,
      isProfilePublic: targetUser.isProfilePublic !== false,
      isLeaderboardPublic: targetUser.isLeaderboardPublic !== false,
      identityMode: targetUser.identityMode || "PSEUDONYMOUS",
      publicAttributionPreference: targetUser.publicAttributionPreference || "HANDLE",
      featuredAchievementIds: targetUser.featuredAchievementIds || [],
      // Private fields and internal trust signals strictly exposed to owner or admin ONLY
      ...(isOwnProfile || isAdmin
        ? {
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

    const BUILTIN_AVATAR_PRESETS = ["recon", "sleuth", "vanguard", "sentinel", "shadow", "archivist"];
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

    if (body.equippedTitle !== undefined) {
      user.equippedTitle = String(body.equippedTitle).trim().slice(0, 60);
    }

    if (body.equippedFrame !== undefined) {
      user.equippedFrame = String(body.equippedFrame).trim().slice(0, 80);
    }

    if (body.equippedTheme !== undefined) {
      user.equippedTheme = String(body.equippedTheme).trim().slice(0, 80);
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

