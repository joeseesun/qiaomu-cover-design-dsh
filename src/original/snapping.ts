export interface SnapHit { delta: number; line: number; edge: number }

/** Keep the same edge/guide pair until it leaves the release radius. All distances
 * are in canvas units; callers convert the six screen-pixel acquisition radius. */
export function snapAxis(edges: number[], lines: number[], radius: number, sticky?: SnapHit): SnapHit | undefined {
  if (sticky && edges[sticky.edge] !== undefined) {
    const delta = sticky.line - edges[sticky.edge]!;
    if (Math.abs(delta) <= radius * 1.8) return { ...sticky, delta };
  }
  let hit: SnapHit | undefined;
  for (const [edge, value] of edges.entries()) for (const line of lines) {
    const delta = line - value;
    if (Math.abs(delta) <= radius && (!hit || Math.abs(delta) < Math.abs(hit.delta))) hit = { delta, line, edge };
  }
  return hit;
}
