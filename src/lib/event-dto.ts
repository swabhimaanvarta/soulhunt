export function toPublicEventDTO(event: any, currentUserId?: string | null) {
  const isRegistered = Boolean(
    currentUserId &&
      event.participants &&
      event.participants.some(
        (p: any) => (p.userId?._id?.toString() || p.userId?.toString()) === currentUserId
      )
  );

  return {
    _id: event._id,
    title: event.title,
    slug: event.slug,
    eventType: event.eventType,
    description: event.description,
    rules: event.rules || [],
    bannerGradient: event.bannerGradient,
    startTime: event.startTime,
    endTime: event.endTime,
    eligibleDepartments: event.eligibleDepartments || ["ALL"],
    isSquadEvent: Boolean(event.isSquadEvent),
    rewardPool: event.rewardPool,
    status: event.status,
    featuredBadge: event.featuredBadge,
    linkedQuestIds: event.linkedQuestIds,
    createdAt: event.createdAt,
    // Strict privacy guarantee: participant identity list is NEVER public
    participantCount: event.participants?.length || 0,
    isRegistered,
  };
}

