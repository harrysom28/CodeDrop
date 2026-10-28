type EventName =
  | 'onboarding_completed'
  | 'pick_locked'
  | 'copy_opened'
  | 'copy_completed'
  | 'follow'
  | 'room_joined'
  | 'subscription_started';

const provider = process.env.EXPO_PUBLIC_ANALYTICS ?? 'console';

export function track(event: EventName, props?: Record<string, unknown>) {
  if (provider === 'none') return;
  // PostHog / Firebase Analytics wired when keys exist. Never invent events.
  console.log('[analytics]', event, props ?? {});
}
