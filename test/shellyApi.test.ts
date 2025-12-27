import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShellyApi } from '../src/shellyApi';

const gw = { host: '1.2.3.4', token: 'secret' } as any;
let fetchMock: any;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-ignore
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ShellyApi', () => {
  it('discovers TRVs from status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ble: { devices: [{ type: 'trv', id: 10, name: 'Living' }, { type: 'sensor', id: 99 }] } }) });
    const api = new ShellyApi(gw, { debug: () => {} } as any);
    const trvs = await api.discoverTrvs();
    expect(trvs.length).toBe(1);
    expect(trvs[0].id).toBe(10);
    expect(trvs[0].name).toBe('Living');
  });

  it('parses TRV state', async () => {
    // First call: RPC status
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.GetStatus')) {
        return { ok: true, json: async () => ({ current_C: 19.5, target_C: 22, pos: 75 }) };
      }
      // second call: /status
      return { ok: true, json: async () => ({ ble: { devices: [{ id: 20, battery: 50, online: true }] } }) };
    });

    const api = new ShellyApi(gw, { debug: () => {} } as any);
    const s = await api.getTrvState(20);
    expect(s.currentTemp).toBe(19.5);
    expect(s.targetTemp).toBe(22);
    expect(s.valve).toBe(75);
    expect(s.battery).toBe(50);
    expect(s.online).toBe(true);
  });

  it('sets target temp via RPC', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const api = new ShellyApi(gw, { debug: () => {} } as any);
    await expect(api.setTargetTemp(5, 21)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
  });
});
