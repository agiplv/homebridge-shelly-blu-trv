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

  // Discovery is no longer supported; all TRVs must be manually configured.


  it('parses TRV state', async () => {
    // Only direct endpoint is supported
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.GetStatus') || url.includes('BluTrv.GetStatus')) {
        return { ok: true, json: async () => ({ current_C: 19.5, target_C: 22, pos: 75, battery: 50, online: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(20);
    expect(s.currentTemp).toBe(19.5);
    expect(s.targetTemp).toBe(22);
    expect(s.valve).toBe(75);
    expect(s.battery).toBe(50);
    expect(s.online).toBe(true);
  });


  it('parses TRV state from BluTrv.GetStatus endpoint', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('BluTrv.GetStatus')) {
        return { ok: true, json: async () => ({ id: 200, target_C: 4.3, current_C: 24.7, pos: 0, errors: ['not_calibrated'], rssi: -41, battery: 100, packet_id: 64, last_updated_ts: 1736161958, paired: true, rpc: true, rsv: 19, online: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(200);
    expect(s.currentTemp).toBe(24.7);
    expect(s.targetTemp).toBe(4.3);
    expect(s.valve).toBe(0);
    expect(s.battery).toBe(100);
    expect(s.online).toBe(true);
  });

  it('sets target temp via RPC', async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('TRV.SetTarget')) {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      if (url.includes('GetStatus')) {
        callCount++;
        return { ok: true, json: async () => ({ current_C: 20, target_C: 21, pos: 50, battery: 80, online: true }) } as any;
      }
      return { ok: true, json: async () => ({}) };
    });
    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const result = await api.setTargetTemp(5, 21);
    expect(result).toBeDefined();
    expect(result.targetTemp).toBe(21);
  });

  it('sets target via BluTrv.Call variant', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('BluTrv.Call') && url.includes('TRV.SetTarget')) {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      if (url.includes('BluTrv.GetStatus') || url.includes('TRV.GetStatus')) {
        return { ok: true, json: async () => ({ current_C: 20, target_C: 22, pos: 50, battery: 80, online: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const result = await api.setTargetTemp(200, 22);
    expect(result).toBeDefined();
    expect(result.targetTemp).toBe(22);
  });


  it('falls back to alternate RPC variant (&id=) when ?id= returns 404', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('GetStatus')) {
        if (url.includes('?id=')) return { ok: false, status: 404 } as any;
        if (url.includes('&id=')) return { ok: true, json: async () => ({ current_C: 21, target_C: 22, pos: 42, battery: 60, online: true }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(100);
    expect(s.currentTemp).toBe(21);
    expect(s.battery).toBe(60);
    expect(s.online).toBe(true);
  });


  it('falls back to POST /rpc/BluTrv.call when GET variants return 404', async () => {
    fetchMock.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('GetStatus')) {
        return { ok: false, status: 404 } as any;
      }
      if (typeof url === 'string' && url.includes('/rpc/BluTrv.call') && opts && opts.method === 'POST') {
        // Return correct fields for TRV state
        return { ok: true, json: async () => ({ current_C: 18, target_C: 19, pos: 33, battery: 70, online: true }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const api = new ShellyApi(gw, { debug: () => {}, error: () => {} } as any);
    const s = await api.getTrvState(200);
    expect(s.currentTemp).toBe(18);
    expect(s.battery).toBe(70);
    expect(s.online).toBe(true);
  });
});
