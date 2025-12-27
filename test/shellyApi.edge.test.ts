import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShellyApi } from '../src/shellyApi';

const gw = { host: '1.2.3.4', token: 'secret' } as any;
let fetchMock: any;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error - set Fetch mock on global
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ShellyApi edge cases', () => {
  it('handles offline device reported in /status', async () => {
    // RPC returns normal
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.GetStatus')) {
        return { ok: true, json: async () => ({ current_C: 18, target_C: 20, pos: 30 }) };
      }
      // /status report device offline
      return { ok: true, json: async () => ({ ble: { devices: [{ id: 33, battery: 80, online: false }] } }) };
    });

    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(33);
    expect(s.online).toBe(false);
    expect(s.battery).toBe(80);
  });

  it('throws when RPC returns non-ok HTTP status', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.GetStatus')) {
        return { ok: false, status: 500 } as any;
      }
      return { ok: true, json: async () => ({ ble: { devices: [{ id: 44, battery: 10, online: true }] } }) };
    });

    const api = new ShellyApi(gw, { debug: () => {} } as any);
    await expect(api.getTrvState(44)).rejects.toBeDefined();
  });

  it('throws when RPC returns malformed JSON', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.GetStatus')) {
        return {
          ok: true,
          json: async () => {
            throw new Error('invalid json');
          }
        } as any;
      }
      return { ok: true, json: async () => ({ ble: { devices: [{ id: 55, battery: 10, online: true }] } }) };
    });

    const api = new ShellyApi(gw, { debug: () => {} } as any);
    await expect(api.getTrvState(55)).rejects.toBeDefined();
  });
});
