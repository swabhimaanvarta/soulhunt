import { connectDB } from "@/lib/db";
import { AuditEvent, UserRole } from "@/models";
import { Types } from "mongoose";

export interface LogAuditParams {
  actorId: Types.ObjectId | string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: "CLAIM" | "LOST_ITEM" | "FOUND_ITEM" | "QUEST" | "EVENT" | "LOCATION" | "USER" | "CONFIG" | "FRAUD_ALERT" | "REWARD" | "TRANSACTION" | "SQUAD" | "ACHIEVEMENT";
  targetId?: Types.ObjectId | string | null;
  targetLabel?: string;
  reason: string;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
}

/**
 * Writes an immutable audit record for administrative, content, custody, or economy actions.
 */
export async function logAuditEvent(params: LogAuditParams) {
  try {
    await connectDB();
    const event = await AuditEvent.create({
      actorId: new Types.ObjectId(params.actorId.toString()),
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ? new Types.ObjectId(params.targetId.toString()) : null,
      targetLabel: params.targetLabel || "",
      reason: params.reason,
      beforeState: params.beforeState || null,
      afterState: params.afterState || null,
      ipAddress: params.ipAddress || "",
    });
    return event;
  } catch (err) {
    console.error("Audit logging error (non-fatal):", err);
    return null;
  }
}

