import { useClosingConfirmation } from '../miniapp/useMiniAppBack';
import { useHardwareBack } from '../nav/useHardwareBack';

/**
 * Mounted only while a live match is on screen. The phone's / mini-app's back button runs the same «press again to leave» step as the
 * pause button (the first press only asks, so a stray tap never forfeits), and closing the mini-app asks for confirmation.
 * It registers after the app-level back handler, so it wins while it is mounted.
 */
export function LeaveGuard({ onLeave }: { onLeave: () => void }) {
  useHardwareBack(onLeave);
  useClosingConfirmation();
  return null;
}
