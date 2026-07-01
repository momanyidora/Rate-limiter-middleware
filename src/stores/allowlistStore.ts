const allowlist = new Set<string>();

export function isAllowlisted(callerId: string): boolean {
  return allowlist.has(callerId);
}

export function addToAllowlist(callerId: string): void {
  allowlist.add(callerId);
}

export function removeFromAllowlist(callerId: string): void {
  allowlist.delete(callerId);
}

export function getAllowlist(): string[] {
  return [...allowlist];
}
