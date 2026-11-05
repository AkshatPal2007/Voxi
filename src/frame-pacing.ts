/** Allow display-aligned 60 Hz updates without rounding 16.66 ms into 30 FPS. */
export function frameDue(now: number, last: number) {
  return last < 0 || now - last >= 1000 / 60 - .75;
}
export function advanceFrameClock(now: number, last: number) {
  if (last < 0) return now;
  const interval=1000/60;
  return last + Math.max(1,Math.floor((now-last+.75)/interval))*interval;
}
