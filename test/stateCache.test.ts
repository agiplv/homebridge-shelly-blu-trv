import { describe, it, expect } from 'vitest';
import { StateCache } from '../src/stateCache';

describe('StateCache', () => {
  it('sets and gets state', () => {
    const s = new StateCache();
    s.set(1, { currentTemp: 20, targetTemp: 22, valve: 50, battery: 80, online: true });
    const st = s.get(1);
    expect(st).toBeDefined();
    expect(st?.currentTemp).toBe(20);
  });

  it('marks offline', () => {
    const s = new StateCache();
    s.set(2, { currentTemp: 21, targetTemp: 23, valve: 40, battery: 70, online: true });
    s.markOffline(2);
    const st = s.get(2);
    expect(st?.online).toBe(false);
  });
});
