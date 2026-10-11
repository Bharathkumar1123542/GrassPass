export function renderStatusText(isLocked: boolean): string {
  return isLocked ? 'Blocked' : 'Unlocked';
}
