import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShellyDiscovery } from '../src/discovery';

// Store browser instance for triggering events
let mockBrowser: any;

// Mock bonjour-service
vi.mock('bonjour-service', () => {
  return {
    Bonjour: vi.fn().mockImplementation(() => {
      return {
        find: vi.fn().mockImplementation(() => {
          const listeners: Record<string, any[]> = {};
          mockBrowser = {
            on: vi.fn((event: string, handler: any) => {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
            }),
            stop: vi.fn(),
            trigger: (event: string, data: any) => {
              if (listeners[event]) {
                listeners[event].forEach(h => h(data));
              }
            }
          };
          return mockBrowser;
        }),
        destroy: vi.fn()
      };
    })
  };
});

describe('ShellyDiscovery', () => {
  let log: any;
  let discovery: ShellyDiscovery;
  let fetchMock: any;

  beforeEach(() => {
    log = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    discovery = new ShellyDiscovery(log);

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should discover BLU gateways with TRVs', async () => {
    const mockBluGwResponse = { some: 'data' };
    const mockComponentsResponse = {
      components: [
        { key: 'blutrv:200' },
        { key: 'blutrv:201' },
        { key: 'other:123' }
      ]
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBluGwResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockComponentsResponse
      });

    // Start discovery in background
    const discoveryPromise = discovery.discoverGateways(200);

    // Wait for browser to be initialized
    await new Promise(resolve => setTimeout(resolve, 10));

    // Trigger "up" event with a Shelly device
    mockBrowser.trigger('up', {
      name: 'shelly-plus-1pm',
      addresses: ['192.168.1.100']
    });

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    expect(results).toHaveLength(1);
    expect(results[0].host).toBe('192.168.1.100');
    expect(results[0].trvIds).toEqual([200, 201]);
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Found BLU Gateway at 192.168.1.100'));
  });

  it('should skip non-Shelly devices', async () => {
    const discoveryPromise = discovery.discoverGateways(200);

    await new Promise(resolve => setTimeout(resolve, 10));

    mockBrowser.trigger('up', {
      name: 'some-other-device',
      addresses: ['192.168.1.200']
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    expect(results).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should skip devices that are not BLU gateways', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false
    });

    const discoveryPromise = discovery.discoverGateways(200);

    await new Promise(resolve => setTimeout(resolve, 10));

    mockBrowser.trigger('up', {
      name: 'shelly-device',
      addresses: ['192.168.1.100']
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    expect(results).toHaveLength(0);
  });

  it('should handle gateways with no TRVs', async () => {
    const mockBluGwResponse = { some: 'data' };
    const mockComponentsResponse = {
      components: [
        { key: 'other:123' }
      ]
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBluGwResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockComponentsResponse
      });

    const discoveryPromise = discovery.discoverGateways(200);

    await new Promise(resolve => setTimeout(resolve, 10));

    mockBrowser.trigger('up', {
      name: 'shelly-device',
      addresses: ['192.168.1.100']
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    expect(results).toHaveLength(1);
    expect(results[0].trvIds).toEqual([]);
  });

  it('should handle fetch errors gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const discoveryPromise = discovery.discoverGateways(200);

    await new Promise(resolve => setTimeout(resolve, 10));

    mockBrowser.trigger('up', {
      name: 'shelly-device',
      addresses: ['192.168.1.100']
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    expect(results).toHaveLength(0);
  });

  it('should deduplicate IPs', async () => {
    const mockBluGwResponse = { some: 'data' };
    const mockComponentsResponse = {
      components: [{ key: 'blutrv:200' }]
    };

    fetchMock
      .mockResolvedValue({
        ok: true,
        json: async () => mockBluGwResponse
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockComponentsResponse
      });

    const discoveryPromise = discovery.discoverGateways(200);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Trigger same IP twice
    mockBrowser.trigger('up', {
      name: 'shelly-device-1',
      addresses: ['192.168.1.100']
    });
    mockBrowser.trigger('up', {
      name: 'shelly-device-2',
      addresses: ['192.168.1.100']
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    // Should only have one entry
    expect(results).toHaveLength(1);
  });

  it('should use referer address if addresses array is not available', async () => {
    const mockBluGwResponse = { some: 'data' };
    const mockComponentsResponse = {
      components: [{ key: 'blutrv:200' }]
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBluGwResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockComponentsResponse
      });

    const discoveryPromise = discovery.discoverGateways(200);

    await new Promise(resolve => setTimeout(resolve, 10));

    mockBrowser.trigger('up', {
      name: 'shelly-device',
      referer: { address: '192.168.1.200' }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const results = await discoveryPromise;

    expect(results).toHaveLength(1);
    expect(results[0].host).toBe('192.168.1.200');
  });
});
