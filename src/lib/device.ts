export function haptic(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Unsupported (e.g. iOS Safari): silently ignore.
  }
}
