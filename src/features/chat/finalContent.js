export function finalContentPatch(usage = {}) {
  return {
    ...(usage.finalContent != null ? { content: usage.finalContent } : {}),
    tailTrimmed: usage.tailTrimmed === true,
  };
}
