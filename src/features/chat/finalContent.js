export function finalContentPatch(usage = {}) {
  return {
    ...(usage.finalContent != null ? { content: usage.finalContent } : {}),
    tailTrimmed: usage.tailTrimmed === true,
    repairAttempted: usage.repairAttempted === true,
    completionRepaired: usage.completionRepaired === true,
    repairSegments: Number.isInteger(usage.repairSegments) ? usage.repairSegments : 0,
  };
}
