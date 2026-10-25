import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { User } from "@/models";
import { logAuditEvent } from "@/lib/audit";
import { apiServerError } from "@/lib/api-error";

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to change your password." } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "Please fill in all password fields." } },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: { code: "PASSWORD_MISMATCH", message: "New passwords do not match." } },
        { status: 400 }
      );
    }

    // Password strength check: min 8 characters, 1 uppercase, 1 lowercase, 1 number
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: "WEAK_PASSWORD", message: "New password must be at least 8 characters long." } },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WEAK_PASSWORD",
            message: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
          },
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: { code: "SAME_PASSWORD", message: "New password must be different from current password." } },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(currentUser._id).select("+passwordHash");
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User account not found." } },
        { status: 404 }
      );
    }

    const isValidCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidCurrent) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PASSWORD", message: "Current password is incorrect." } },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newHash;
    await user.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "USER_PASSWORD_CHANGED",
      targetType: "USER",
      targetId: user._id,
      targetLabel: `@${user.username}`,
      reason: "User self-updated account password.",
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. Your new password is now active.",
    });
  } catch (error: any) {
    return apiServerError("Password update failed", error);
  }
}

