/** A detached Harness panel has no computed padding or usable layout. Never feed
 * that transient geometry to Fabric: zoomToPoint otherwise leaves NaN offsets. */
export function mountedCanvasSize(stage: HTMLElement | undefined): boolean {
  return !!stage?.isConnected && stage.clientWidth > 0 && stage.clientHeight > 0;
}
