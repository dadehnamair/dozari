/** Who has a live socket right now. A player with the app open on two tabs counts once and stays online until both close. */
export class Presence {
  private readonly open = new Map<string, number>();

  connect(userId: string): void {
    this.open.set(userId, (this.open.get(userId) ?? 0) + 1);
  }

  disconnect(userId: string): void {
    const n = (this.open.get(userId) ?? 0) - 1;
    if (n > 0) this.open.set(userId, n);
    else this.open.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.open.has(userId);
  }
}
