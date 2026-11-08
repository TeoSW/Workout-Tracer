/** True when running as the installed app, not in a browser tab. */
export function isStandalone(): boolean {
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia('(display-mode: standalone)').matches;
}
