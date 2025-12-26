import { TrvState } from "./types";

export class StateCache {
  private readonly cache = new Map<number, TrvState>();

  set(id: number, state: TrvState) {
    this.cache.set(id, state);
  }

  get(id: number) {
    return this.cache.get(id);
  }

  markOffline(id: number) {
    const prev = this.cache.get(id);
    if (prev) {
      this.cache.set(id, { ...prev, online: false });
    }
  }
}
