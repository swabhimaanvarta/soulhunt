import { SquadRole } from "@/models";
export type { SquadRole };

// Numerical hierarchy for role comparisons: LEADER (4) > COLEADER (3) > ELDER (2) > MEMBER (1)
// OFFICER is treated as COLEADER level during backward compatibility
export const ROLE_HIERARCHY: Record<SquadRole, number> = {
  LEADER: 4,
  COLEADER: 3,
  OFFICER: 3, // backward compatibility
  ELDER: 2,
  MEMBER: 1,
};

export function normalizeSquadRole(role?: string | null): SquadRole {
  if (!role) return "MEMBER";
  const upper = role.toUpperCase();
  if (upper === "LEADER") return "LEADER";
  if (upper === "COLEADER" || upper === "OFFICER") return "COLEADER";
  if (upper === "ELDER") return "ELDER";
  return "MEMBER";
}

/**
 * Can edit squad identity: name, tag, description, emblem, banner, tags, privacy
 * Allowed: Leader, CoLeader
 */
export function canEditSquadSettings(role: SquadRole): boolean {
  const norm = normalizeSquadRole(role);
  return norm === "LEADER" || norm === "COLEADER";
}

/**
 * Can accept or decline join requests
 * Allowed: Leader, CoLeader, Elder
 */
export function canManageJoinRequests(role: SquadRole): boolean {
  const norm = normalizeSquadRole(role);
  return norm === "LEADER" || norm === "COLEADER" || norm === "ELDER";
}

/**
 * Can remove a squad member
 * Rule: Actor must strictly outrank target member.
 * - Elder can remove Member
 * - CoLeader can remove Member, Elder
 * - Leader can remove Member, Elder, CoLeader
 * - Sole Leader cannot remove themselves
 * - Equal or higher role removal is strictly prohibited
 */
export function canRemoveSquadMember(
  actorRole: SquadRole,
  targetRole: SquadRole,
  isTargetSoleLeader: boolean = false
): boolean {
  if (isTargetSoleLeader) return false;
  const actorLevel = ROLE_HIERARCHY[normalizeSquadRole(actorRole)] || 0;
  const targetLevel = ROLE_HIERARCHY[normalizeSquadRole(targetRole)] || 0;
  return actorLevel > targetLevel;
}

/**
 * Can promote/demote Elder
 * Allowed: Leader, CoLeader
 */
export function canPromoteDemoteElder(actorRole: SquadRole): boolean {
  const norm = normalizeSquadRole(actorRole);
  return norm === "LEADER" || norm === "COLEADER";
}

/**
 * Can promote/demote CoLeader
 * Allowed: Leader ONLY
 */
export function canPromoteDemoteCoLeader(actorRole: SquadRole): boolean {
  return normalizeSquadRole(actorRole) === "LEADER";
}

/**
 * Can transfer leadership or disband squad
 * Allowed: Leader ONLY
 */
export function canTransferOrDisband(actorRole: SquadRole): boolean {
  return normalizeSquadRole(actorRole) === "LEADER";
}

/**
 * Can moderate / remove messages in squad chat
 * Allowed: Leader, CoLeader, Elder
 */
export function canModerateMessages(actorRole: SquadRole): boolean {
  const norm = normalizeSquadRole(actorRole);
  return norm === "LEADER" || norm === "COLEADER" || norm === "ELDER";
}

/**
 * Can read / send squad chat messages
 * Allowed: all active members (Member, Elder, CoLeader, Leader)
 * Non-Member: No
 */
export function canAccessSquadChat(role?: SquadRole | string | null): boolean {
  if (!role) return false;
  const upper = String(role).toUpperCase();
  return (
    upper === "LEADER" ||
    upper === "COLEADER" ||
    upper === "OFFICER" ||
    upper === "ELDER" ||
    upper === "MEMBER"
  );
}

/**
 * Can report a chat message or mute a user locally
 * Allowed: Leader, Co-Leader, Elder, Member (any active squad member)
 * Non-Member: No
 */
export function canReportChatMessage(role?: SquadRole | string | null): boolean {
  return canAccessSquadChat(role);
}

export function canMuteUserLocally(role?: SquadRole | string | null): boolean {
  return canAccessSquadChat(role);
}
