/** Переносит наблюдаемое состояние Core без численного fallback. */
export function snapshotState(snapshot, { theme, contrast }) {
  return {
    state: snapshot.state,
    reason: snapshot.reason,
    revision: snapshot.revision,
    snapshotVersion: snapshot.snapshotVersion,
    theme,
    contrast,
    outputCount: snapshot.outputCount(),
  };
}
