import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShellyTrvAccessory } from '../src/accessory';
import { ShellyBluPlatform } from '../src/platform';
import { ShellyApi } from '../src/shellyApi';
import { StateCache } from '../src/stateCache';

function createMockHap() {
  const Characteristic: any = {
    CurrentTemperature: 'CurrentTemperature',
    TargetTemperature: 'TargetTemperature',
    CurrentRelativeHumidity: 'CurrentRelativeHumidity',
    BatteryLevel: 'BatteryLevel'
  };
  const Service: any = {
    Thermostat: 'Thermostat',
    Battery: 'Battery'
  };
  const HAPStatus = { SERVICE_COMMUNICATION_FAILURE: -70402 };
  class HapStatusError extends Error {
    code: number;
    constructor(code: number, msg?: string) {
      super(msg);
      this.code = code;
    }
  }
  return { Characteristic, Service, HAPStatus, HapStatusError, uuid: { generate: (s: string) => `uuid:${s}` } } as any;
}

function createMockAccessory(name: string, id: number, hap: any) {
  const services: Record<string, any> = {};
  return {
    displayName: name,
    UUID: `uuid:${name}:${id}`,
    context: { device: { id, name }, gateway: {} },
    getService(key: string) {
      return services[key];
    },
    addService(key: string) {
      const svc = {
        _charMap: new Map<string, any>(),
        getCharacteristic(c: string) {
          if (!svc._charMap.has(c)) {
            svc._charMap.set(c, {
              onGet: (fn: any) => { svc._charMap.get(c)._onGet = fn; return svc._charMap.get(c); },
              onSet: (fn: any) => { svc._charMap.get(c)._onSet = fn; return svc._charMap.get(c); },
              _onGet: undefined,
              _onSet: undefined
            });
          }
          return svc._charMap.get(c);
        }
      };
      services[key] = svc;
      return svc;
    }
  } as any;
}

describe('ShellyTrvAccessory', () => {
  let hap: any;
  let platform: any;
  let accessory: any;

  beforeEach(() => {
    hap = createMockHap();
    platform = {
      api: { hap },
      stateCache: new StateCache()
    } as any;
    accessory = createMockAccessory('TestTRV', 1, hap);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads characteristics from state cache', async () => {
    platform.stateCache.set(1, { currentTemp: 18.3, targetTemp: 21, valve: 40, battery: 77, online: true });
    const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;
    const acc = new ShellyTrvAccessory(platform as any, accessory as any, log);

    const svc = accessory.getService(hap.Service.Thermostat);
    // Call the stored onGet for CurrentTemperature
    const curTempChar = svc.getCharacteristic(hap.Characteristic.CurrentTemperature);
    const val = await curTempChar._onGet();
    expect(val).toBe(18.3);

    const bsvc = accessory.getService(hap.Service.Battery);
    const battChar = bsvc.getCharacteristic(hap.Characteristic.BatteryLevel);
    const batt = await battChar._onGet();
    expect(batt).toBe(77);
  });

  it('sets target temperature via ShellyApi', async () => {
    platform.stateCache.set(2, { currentTemp: 18.3, targetTemp: 21, valve: 40, battery: 77, online: true });
    accessory.context.device.id = 2;
    const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

    const setSpy = vi.spyOn(ShellyApi.prototype, 'setTargetTemp').mockResolvedValue(undefined as any);

    const acc = new ShellyTrvAccessory(platform as any, accessory as any, log);
    const svc = accessory.getService(hap.Service.Thermostat);
    const targetChar = svc.getCharacteristic(hap.Characteristic.TargetTemperature);

    // Simulate setting the target temperature
    await targetChar._onSet(23);

    expect(setSpy).toHaveBeenCalledWith(2, 23);
  });

  it('throws HapStatusError when device offline', async () => {
    platform.stateCache.set(3, { currentTemp: 18.3, targetTemp: 21, valve: 40, battery: 77, online: false });
    accessory.context.device.id = 3;
    const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

    // Provide HAP-specific error and status so accessory can throw similar kind
    platform.api.hap.HapStatusError = (class extends Error { constructor(msg?: string){ super(msg); } });
    platform.api.hap.HAPStatus = { SERVICE_COMMUNICATION_FAILURE: -70402 };

    const acc = new ShellyTrvAccessory(platform as any, accessory as any, log);
    const svc = accessory.getService(hap.Service.Thermostat);
    const curTempChar = svc.getCharacteristic(hap.Characteristic.CurrentTemperature);

    expect(() => curTempChar._onGet()).toThrow();
  });
});

describe('ShellyBluPlatform', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers TRVs and registers accessories and polls state', async () => {
    const hap = createMockHap();
    const registered: any[] = [];
    const fakeApi: any = {
      hap,
      platformAccessory: (function() { 
        // class-like constructor used with `new` in platform
        return function PlatformAccessory(name: string, uuid: string) {
          const obj = createMockAccessory(name, 999, hap);
          Object.assign(this, obj);
        };
      })(),
      registerPlatformAccessories: (pluginName: string, platformName: string, accs: any[]) => {
        registered.push(...accs);
      },
      // minimal event handling used by the platform constructor
      on: (_ev: string, _cb: any) => { /* noop for tests */ }
    };

    const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;
    const config = { gateways: [{ host: 'gw', token: 't', pollInterval: 60 }] } as any;

    const discoverSpy = vi.spyOn(ShellyApi.prototype, 'discoverTrvs').mockResolvedValue([{ id: 7, name: 'Bedroom' }]);
    const stateSpy = vi.spyOn(ShellyApi.prototype, 'getTrvState').mockResolvedValue({ currentTemp: 16, targetTemp: 20, valve: 30, battery: 66, online: true });

    const platform = new ShellyBluPlatform(log, config, fakeApi as any);

    // Directly call discover (constructor wiring normally calls this on didFinishLaunching)
    await platform.discover();

    // allow the async poll() invoked inside discover() to complete
    await new Promise((r) => setImmediate(r));

    // ensure discoverTrvs was called
    expect(discoverSpy).toHaveBeenCalled();
    // expectation: accessory was registered
    expect(registered.length).toBe(1);

    // state should be present in cache
    const uuid = fakeApi.hap.uuid.generate(`${config.gateways[0].host}-7`);
    const acc = platform['accessories'].get(uuid);
    expect(acc).toBeDefined();

    const state = platform.stateCache.get(7);
    expect(state).toBeDefined();
    expect(state?.currentTemp).toBe(16);
  });

  it('falls back to manual devices when discovery fails', async () => {
    const hap = createMockHap();
    const registered: any[] = [];
    const fakeApi: any = {
      hap,
      platformAccessory: (function() {
        return function PlatformAccessory(name: string, uuid: string) {
          const obj = createMockAccessory(name, 999, hap);
          Object.assign(this, obj);
        };
      })(),
      registerPlatformAccessories: (pluginName: string, platformName: string, accs: any[]) => {
        registered.push(...accs);
      },
      on: (_ev: string, _cb: any) => { /* noop */ }
    };

    const log = { debug: () => {}, info: () => {}, warn: vi.fn(), error: () => {} } as any;
    const config = { gateways: [{ host: 'gw', token: 't', pollInterval: 60, devices: [{ id: 42, name: 'Manual TRV' }] }] } as any;

    const discoverSpy = vi.spyOn(ShellyApi.prototype, 'discoverTrvs').mockRejectedValue(new Error('404 Not Found'));
    const stateSpy = vi.spyOn(ShellyApi.prototype, 'getTrvState').mockResolvedValue({ currentTemp: 21, targetTemp: 22, valve: 33, battery: 50, online: true });

    const platform = new ShellyBluPlatform(log, config, fakeApi as any);
    await platform.discover();
    await new Promise((r) => setImmediate(r));

    expect(discoverSpy).toHaveBeenCalled();
    expect(registered.length).toBe(1);

    const state = platform.stateCache.get(42);
    expect(state).toBeDefined();
    expect(state?.currentTemp).toBe(21);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Discovery failed'));
  });
});
