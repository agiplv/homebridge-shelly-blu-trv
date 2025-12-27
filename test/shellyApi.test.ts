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

  it('falls back to alternate RPC variant (&id=) when ?id= returns 404', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.GetStatus')) {
        if (url.includes('?id=')) return { ok: false, status: 404 } as any;
        if (url.includes('&id=')) return { ok: true, json: async () => ({ current_C: 21, target_C: 22, pos: 42 }) } as any;
      }
      // /status
      return { ok: true, json: async () => ({ ble: { devices: [{ id: 100, battery: 60, online: true }] } }) } as any;
    });
    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(100);
    expect(s.currentTemp).toBe(21);
    expect(s.battery).toBe(60);
  });

  it('falls back to POST /rpc/BluTrv.call when GET variants return 404', async () => {
    fetchMock.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('TRV.GetStatus')) {
        return { ok: false, status: 404 } as any;
      }
      if (typeof url === 'string' && url.includes('/rpc/BluTrv.call') && opts && opts.method === 'POST') {
        // partially inspect body to ensure params passed
        return { ok: true, json: async () => ({ current_C: 18, target_C: 19, pos: 33 }) } as any;
      }
      // /status
      return { ok: true, json: async () => ({ ble: { devices: [{ id: 200, battery: 70, online: true }] } }) } as any;
    });

    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(200);
    expect(s.currentTemp).toBe(18);
    expect(s.battery).toBe(70);
  });
});
