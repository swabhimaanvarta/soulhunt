import { UserRole } from "@/models";

export interface UserLike {
  _id?: any;
  role?: UserRole | string;
  assignedStationId?: any;
  assignedStationIds?: any[];
}

/**
 * Validates if the user is authorized to enter the Operations & Management surface.
 * Accessible to ADMIN, MODERATOR, and SAFE_DESK_STAFF.
 */
export function canAccessAdminPanel(user?: UserLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role === "ADMIN" || user.role === "MODERATOR" || user.role === "SAFE_DESK_STAFF";
}

/**
 * Economy configuration & multipliers can strictly only be managed by ADMIN.
 */
export function canManageEconomy(user?: UserLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role === "ADMIN";
}

/**
 * Staff role grants and station assignments can strictly only be managed by ADMIN.
 */
export function canManageStaff(user?: UserLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role === "ADMIN";
}

/**
 * Quest, Event, and Location content can be managed by ADMIN and MODERATOR.
 */
export function canManageContent(user?: UserLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role === "ADMIN" || user.role === "MODERATOR";
}

/**
 * Fraud alerts review and dispute resolution can be handled by ADMIN and MODERATOR.
 */
export function canResolveFraud(user?: UserLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role === "ADMIN" || user.role === "MODERATOR";
}

/**
 * Scoped check for physical custody desk operations (intake, transfer, release).
 * ADMIN and MODERATOR have campus-wide jurisdiction.
 * SAFE_DESK_STAFF are strictly scoped to their assigned station(s).
 * Missing or null stationId MUST deny mutation access.
 */
export function canManageStationCustody(user?: UserLike | null, stationId?: string | null): boolean {
  if (!user || !user.role) return false;
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  if (user.role === "SAFE_DESK_STAFF") {
    if (!stationId) return false; // Strictly deny missing station ID for mutations
    const targetStr = stationId.toString();
    if (user.assignedStationId && user.assignedStationId.toString() === targetStr) {
      return true;
    }
    if (Array.isArray(user.assignedStationIds)) {
      return user.assignedStationIds.some((id: any) => id.toString() === targetStr);
    }
  }
  return false;
}

/**
 * Scoped check for viewing station queues.
 * ADMIN and MODERATOR can view all stations.
 * SAFE_DESK_STAFF can view only their assigned station.
 */
export function canViewStationQueue(user?: UserLike | null, stationId?: string | null): boolean {
  if (!user || !user.role) return false;
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  if (user.role === "SAFE_DESK_STAFF") {
    if (!stationId) return Boolean(user.assignedStationId || user.assignedStationIds?.length);
    const targetStr = stationId.toString();
    if (user.assignedStationId && user.assignedStationId.toString() === targetStr) return true;
    if (Array.isArray(user.assignedStationIds)) {
      return user.assignedStationIds.some((id: any) => id.toString() === targetStr);
    }
  }
  return false;
}

/**
 * Checks if the user has any staff or moderator powers.
 */
export function isStaffOrModerator(user?: UserLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role === "ADMIN" || user.role === "MODERATOR" || user.role === "SAFE_DESK_STAFF";
}

