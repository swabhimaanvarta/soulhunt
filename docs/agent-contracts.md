# AIEM Hunt — Shared System Contracts & Schema Freezes
**Document Version:** 1.0.0  
**Effective Date:** 25 October 2026  
**Status:** FROZEN — Mandatory baseline for all agent workstreams

---

## Overview & Ownership Rules

This document establishes the frozen contracts across all 6 AIEM Hunt workstreams.
As specified in the Coordinator Brief:
- The **Coordinator alone** edits `src/models/index.ts`, `package.json`, `next.config.mjs`, shared auth/error utilities, and deployment configuration.
- Workstreams Scaffold and build features strictly against these contracts without inventing incompatible field names or duplicate sources of truth.
- No raw Mongoose documents may ever be returned in HTTP API endpoints.

---

## 1. Item & Quest Audience DTO Allowlists

### 1.1 Lost & Found Items (`/api/items`, `/api/items/[id]`)

Never return raw Mongoose documents. Every response must project through allowlist transformers.

#### Audience Projections:
| Field | Public / Unauth / Unrelated Seeker | Owner (Reporter / Finder) | Assigned Safe-Desk Staff | Admin / Moderator |
|---|:---:|:---:|:---:|:---:|
| `_id`, `itemType` ("LOST"\|"FOUND") | ✅ | ✅ | ✅ | ✅ |
| `title` (sanitized of student IDs/matriculation) | ✅ | ✅ (unscrubbed available) | ✅ | ✅ |
| `category` | ✅ | ✅ | ✅ | ✅ |
| `publicDescription` (PII redacted via `[REDACTED-*]`) | ✅ (sanitized) | ✅ | ✅ | ✅ |
| `status`, `custodyStatus` | ✅ | ✅ | ✅ | ✅ |
| `safeDeskLocationId` | ✅ | ✅ | ✅ | ✅ |
| `location` (coarse zone name, code, hours only) | ✅ | ✅ | ✅ | ✅ |
| `photoUrl` (blurred derivative ONLY) | ✅ (no raw fallback) | ✅ | ✅ | ✅ |
| `rawPhotoUrl` | ❌ OMITTED | ✅ | ✅ | ✅ |
| `secretIdentifiers` | ❌ OMITTED | ✅ | ✅ | ✅ |
| `verificationQuestion` | ❌ OMITTED (only `hasVerificationQuestion: true`) | ✅ | ✅ | ✅ |
| `verificationAnswerHash` | ❌ OMITTED | ❌ OMITTED | ❌ OMITTED | ❌ OMITTED |
| `spotDetails` / fine coordinates | ❌ OMITTED | ✅ | ✅ | ✅ |
| `lockerReceiptCode` | ❌ OMITTED | ❌ OMITTED | ✅ (station scoped) | ✅ |
| `reporterId` / `finderId` identity | ❌ OMITTED | ✅ | ✅ | ✅ |
| `claims` list | ❌ OMITTED | ✅ (summaries only) | ✅ (station scoped) | ✅ |

**Zero-Fallback Rule:** If `blurredPhotoUrl` is absent, `photoUrl` MUST resolve to an empty string (`""`). Never fall back to unreviewed raw user uploads.

---

### 1.2 Quests & Investigations (`/api/quests`, `/api/quests/[id]`)

#### Audience Projections:
| Field | Public Seeker | Active Participant | Creator / Admin |
|---|:---:|:---:|:---:|
| `_id`, `questCode`, `title`, `description` | ✅ | ✅ | ✅ |
| `questType`, `difficulty`, `xpReward`, `coinReward` | ✅ | ✅ | ✅ |
| `status` ("ACTIVE" only) | ✅ | ✅ | ✅ (includes DRAFT/ARCHIVED) |
| `currentCompletions` | ✅ | ✅ | ✅ |
| `linkedLostItemId` | ❌ OMITTED | ❌ OMITTED | ✅ |
| `restrictedRoomNote` | ❌ OMITTED | ✅ (only for unlocked room) | ✅ |
| `clues` (Future stages > current unlocked) | ❌ OMITTED | ❌ OMITTED | ✅ |
| `clues` (Expected answers & passcodes) | ❌ OMITTED | ❌ OMITTED | ✅ |
| `clues` (Hints) | ❌ OMITTED | ✅ (only if unlocked via coins) | ✅ |
| `revisions` history | ❌ OMITTED | ❌ OMITTED | ✅ |

---

## 2. Bounded Cursor Pagination Contract

All collection listings (`/api/items`, `/api/quests`, `/api/events`, `/api/notifications`, `/api/admin/*`) MUST use bounded cursor pagination:

### Parameters:
- `limit`: Default `20`, hard clamped maximum `50`.
- `cursor`: Opaque Base64-encoded string representing a stable tie-breaker tuple:
  - Standard timestamp sort: `{"createdAt": "<ISOString>", "_id": "<ObjectId>"}`
  - Categorical sort: `{"category": "<Category>", "createdAt": "<ISOString>", "_id": "<ObjectId>"}`

### Response Envelope:
```json
{
  "success": true,
  "data": [ ... ],
  "pageInfo": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTEwLTI1VDE0OjAwOjAwLjAwMFoiLCJfaWQiOiI2YWRk..." ,
    "hasMore": true,
    "total": 42
  }
}
```

### Combined LOST & FOUND Merge Contract:
When listing unified items (`itemType=ALL`), pagination queries query both collections with `limit + 1`, sort each by `createdAt DESC, _id DESC`, merge sort up to `limit`, and encode both sub-cursors into a unified dual-stream cursor. Never load unbounded collections into memory.

---

## 3. Standardized Mutation & Error Envelopes

Every API endpoint must respond in one of two standard shapes:

### 3.1 Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional user-friendly confirmation"
}
```

### 3.2 Error Response:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "User-safe, non-technical explanation.",
    "requestId": "optional-request-id",
    "details": null
  }
}
```

### 3.3 Security & Error Sanitization Rules:
1. **No Raw Leaks:** Never return `error.message` from caught Mongoose, database, driver, or system exceptions. Technical details must be logged to the server console via `apiServerError(err, code, message, requestId)` and client receives a sanitized, stable message.
2. **Standard HTTP Status Codes:**
   - `400`: `INVALID_INPUT`, `VALIDATION_FAILED`, `MISSING_FIELDS`, `ALREADY_COMPLETED`
   - `401`: `UNAUTHORIZED` (Authentication required)
   - `403`: `FORBIDDEN` (Insufficient permissions, out-of-station custody, non-member chat)
   - `404`: `NOT_FOUND` (Item, quest, squad, or user not found)
   - `429`: `RATE_LIMITED` (Action cooldown or burst limit exceeded)
   - `500`: `INTERNAL_SERVER_ERROR` (Sanitized server catch block)

### 3.4 Idempotency & Replay:
Mutating endpoints (`/api/rewards/purchase`, `/api/investigations/[id]/hint`, `/api/squads/[id]/messages`, `/api/claims/verify-handover`) accept an optional client-provided `requestId`.
- Replaying a request with the same `requestId` returns the previous transaction or message with `{ success: true, data: ..., replayed: true }`.
- Duplicate submissions never produce double debits, duplicate transactions, or corrupt balances.

---

## 4. Squad Roles, Hierarchy & Membership Invariants

### 4.1 Role Hierarchy & Weights:
```
LEADER (4) > COLEADER (3) == OFFICER (3 legacy) > ELDER (2) > MEMBER (1)
```

### 4.2 Migration Mapping:
- Legacy `OFFICER` roles normalize to `COLEADER`.
- Default unassigned roles normalize to `MEMBER`.
- `Squad.leaderId` remains the authoritative sole Leader of the squad.

### 4.3 Permission Matrix:
| Capability | LEADER | COLEADER | ELDER | MEMBER |
|---|:---:|:---:|:---:|:---:|
| Edit Squad Identity (name, banner, privacy, tags) | ✅ | ✅ | ❌ | ❌ |
| Accept / Decline Join Requests | ✅ | ✅ | ✅ | ❌ |
| Moderate / Remove Chat Messages | ✅ | ✅ | ✅ | ❌ |
| Remove Squad Member | ✅ (outranks target) | ✅ (Elders/Members) | ✅ (Members only) | ❌ |
| Promote / Demote Elder | ✅ | ✅ | ❌ | ❌ |
| Promote / Demote CoLeader | ✅ | ❌ | ❌ | ❌ |
| Disband Squad / Transfer Leadership | ✅ (Leader only) | ❌ | ❌ | ❌ |
| Read / Post in Squad Chat | ✅ | ✅ | ✅ | ✅ |

### 4.4 Invariants:
1. **Single Membership Invariant:** A user can be an active member of at most ONE squad (`SquadMember.index({ userId: 1 }, { unique: true })`).
2. **Sole Leader Removal Guard:** A Leader cannot leave or be removed while other members exist in the squad without explicitly transferring leadership first.
3. **Outranking Removal Guard:** Member removals require `actorRoleWeight > targetRoleWeight`. Peers cannot remove peers (Elder cannot remove Elder; CoLeader cannot remove CoLeader).

---

## 5. Squad Chat Retention & Polling Contract

### 5.1 Chat Message Model:
- `squadId`: Reference to `Squad`
- `senderId`: Reference to `User` (populated with `displayName`, `username`, `avatarUrl`, `rankTitle`)
- `text`: Plain text string (max 1,000 chars, whitespace trimmed, HTML entities escaped)
- `moderationState`: `"VISIBLE"` | `"HIDDEN"` | `"REMOVED"`
- `requestId`: Sparse index for client idempotency
- `expiresAt`: Date set to `now + 30 days`
- `createdAt`: Date

### 5.2 Dual Retention & Tombstone Lifecycle:
1. **500-Message Cap:** When messages exceed 500 in a squad, oldest messages are pruned using deterministic compound cutoff `({ createdAt: { $lt: cutoff.createdAt } }, { createdAt: cutoff.createdAt, _id: { $lt: cutoff._id } })`. Pruning deletes expired messages first and excludes them from the cap. Pruning is safe under concurrent parallel writes.
2. **30-Day TTL:** MongoDB TTL index on `expiresAt` automatically purges expired records.
3. **Immediate Expired Exclusion:** All queries include `expiresAt: { $gt: new Date() }` so expired messages vanish immediately even if the background TTL worker is delayed.
4. **Tombstone Semantics:** Moderated messages transition to `moderationState: "REMOVED"`, and their text is replaced with `"[This message was removed by squad leadership]"`. The GET endpoint serves tombstones with `moderationState !== "HIDDEN"` so conversation continuity is preserved without leaking inappropriate text. Truly redacted internal messages use `HIDDEN` and are omitted.

### 5.3 Client Polling & Rate Limiting:
- Polling occurs at **5-second base intervals** only while the tab is active (`document.visibilityState === "visible"`) and client is online (`navigator.onLine === true`).
- Polling immediately pauses on tab blur, offline disconnection, or route unmount.
- **Dynamic Error Backoff:** On network or HTTP errors, polling backs off exponentially (e.g. 5s -> 7.5s -> 11s up to 60s), resetting to 5s immediately upon successful response or reconnection.
- Rate limits enforced per user:
  - Cooldown: 1 message per 2 seconds.
  - Burst cap: 10 messages per minute.

---

## 6. Entity Lifecycles & History Rules

### 6.1 Quest Lifecycle:
```
DRAFT ──► ACTIVE (Published) ──► ARCHIVED
```
- Hard delete is permitted **only** on unreferenced `DRAFT` quests.
- Published quests with completions or active investigations MUST transition to `ARCHIVED`, preserving historical player dossiers.
- Edits append an entry to `revisions: [{ editedBy, editedByName, note, timestamp }]`.

### 6.2 Event Lifecycle:
```
DRAFT ──► UPCOMING ──► LIVE ──► ENDED ──► ARCHIVED
                          │
                          └──► CANCELLED
```
- Participant arrays are private. Public views expose `participantCount: number` and viewer-specific `isRegistered: boolean`.
- Material schedule changes or cancellations trigger notifications to registered participants.

### 6.3 Achievement Lifecycle:
```
ACTIVE ◄──► ARCHIVED
```
- Archiving an achievement prevents new unlocks but preserves historical unlocks in player profiles.
- Hard delete is prohibited if `UserAchievement.countDocuments({ achievementId }) > 0`.
- Version counter increments on definition updates.

---

## 7. Campus Map & Location Coordinates

### 7.1 Verified AIEM Campus Boundary:
- `minLat`: `15.5900`
- `maxLat`: `15.6050`
- `minLng`: `73.7900`
- `maxLng`: `73.8050`
- Campus Centroid: `[15.5948, 73.7947]`

### 7.2 Safety & Privacy Guarantees:
- Public map pins represent verified, approved campus zones (safe-desks, academic blocks, landmarks).
- **No User GPS Persisted:** Student last-seen locations use coarse campus zones (`CampusLocation`), never mobile GPS coordinates.
- Location deletion guard: Locations referenced by active items or custody lockers cannot be deleted; they must be archived.

---

## 8. Feature Flags & Staging Configuration

Controlled in `src/lib/featureFlags.ts` via environment variables:

| Flag Name | Default | Rollback Value | Behavior when `false` |
|---|:---:|:---:|---|
| `SQUAD_CHAT_ENABLED` | `true` | `false` | Disables chat read/send; endpoints return 403 `FEATURE_DISABLED` |
| `SQUAD_ROLE_V2_ENABLED` | `true` | `false` | Falls back to simplified Member/Leader squad roles |
| `VIRTUAL_SHOP_ENABLED` | `true` | `false` | Hides virtual cosmetic catalog |
| `NEW_MAP_ENABLED` | `true` | `false` | Falls back to static map view |

Flags default to `true` unless explicitly set to `"false"`. Setting any flag to `"false"` immediately deactivates the subsystem without requiring database migrations or schema adjustments.

