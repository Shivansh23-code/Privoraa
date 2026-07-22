/** Flatten persisted response-plan metadata into the live message shape used by chat UI. */
export function normalizeRemoteMessage(message = {}) {
  const plan = message.responsePlan;
  if (!plan || typeof plan !== 'object') return message;
  const sections = Array.isArray(plan.sections) ? plan.sections : [];
  const boundary = Number.isInteger(plan.firstSegmentEnd) ? plan.firstSegmentEnd : sections.length;
  const segmentIndex = Number.isInteger(plan.segmentIndex) ? plan.segmentIndex : undefined;
  const completedSections = Array.isArray(plan.completedSections)
    ? plan.completedSections
    : segmentIndex > 1 ? sections.slice(0, boundary) : [];
  const remainingSections = Array.isArray(plan.remainingSections)
    ? plan.remainingSections
    : segmentIndex > 1 ? [] : sections.slice(boundary);
  return {
    ...message,
    segmentIndex,
    totalSegments: Number.isInteger(plan.totalSegments) ? plan.totalSegments : undefined,
    completedSections,
    remainingSections,
    hasRemainingContent: typeof plan.hasRemainingContent === 'boolean'
      ? plan.hasRemainingContent
      : remainingSections.length > 0,
  };
}
