export interface AllowlistRule {
  ip: string;
  description?: string;
}

export class Allowlist {
  private readonly entries: Set<string>;

  constructor(allowedIps: string[] = []) {
    this.entries = new Set(allowedIps);
  }

  public add(ip: string): void {
    this.entries.add(ip);
  }

  public remove(ip: string): void {
    this.entries.delete(ip);
  }

  public isAllowed(ip: string): boolean {
    return this.entries.has(ip);
  }

  public list(): string[] {
    return Array.from(this.entries);
  }
}
