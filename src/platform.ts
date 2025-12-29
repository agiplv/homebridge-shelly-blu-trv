import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig
} from "homebridge";
import { PLATFORM_NAME, GatewayConfig } from "./types";
import { ShellyApi } from "./shellyApi";
import { ShellyTrvAccessory } from "./accessory";
import { StateCache } from "./stateCache";
import { ShellyDiscovery } from "./discovery";

export class ShellyBluPlatform implements DynamicPlatformPlugin {
  public readonly stateCache = new StateCache();
  private readonly accessories = new Map<string, PlatformAccessory>();
  private readonly trvInstances = new Map<number, ShellyTrvAccessory>();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.log.debug("[ShellyBluPlatform] Initializing platform");
    api.on("didFinishLaunching", () => {
      this.log.debug("[ShellyBluPlatform] Homebridge finished launching, starting device discovery");
      this.discover();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug(`[ShellyBluPlatform] Configuring cached accessory: ${accessory.displayName}`);
    this.accessories.set(accessory.UUID, accessory);
  }

  async discover() {
    let gateways = (this.config.gateways ?? []) as GatewayConfig[];
    const enableAutoDiscovery = this.config.enableAutoDiscovery !== false; // Default to true

    // Run auto-discovery if enabled
    if (enableAutoDiscovery) {
      this.log.info("[ShellyBluPlatform] Auto-discovery enabled, scanning for gateways...");
      try {
        const discovery = new ShellyDiscovery(this.log);
        const discovered = await discovery.discoverGateways();

        // Build a map of manually configured devices by gateway host
        const manualGateways = new Map<string, GatewayConfig>();
        for (const gw of gateways) {
          manualGateways.set(gw.host, gw);
        }

        // Merge discovered gateways with manual config
        for (const disc of discovered) {
          const manual = manualGateways.get(disc.host);
          if (manual) {
            // Gateway exists in manual config - merge TRVs
            const manualTrvIds = new Set(manual.devices.map(d => d.id));
            for (const trvId of disc.trvIds) {
              if (!manualTrvIds.has(trvId)) {
                manual.devices.push({ id: trvId, name: `TRV ${trvId}` });
                this.log.info(`[Discovery] Added discovered TRV ${trvId} to gateway ${disc.host} (using default name)`);
              }
            }
          } else {
            // New gateway not in manual config - add it
            const newGw: GatewayConfig = {
              host: disc.host,
              pollInterval: 60,
              devices: disc.trvIds.map(id => ({ id, name: `TRV ${id}` }))
            };
            gateways.push(newGw);
            this.log.info(`[Discovery] Added discovered gateway ${disc.host} with ${disc.trvIds.length} TRV(s)`);
          }
        }
      } catch (error) {
        this.log.error(`[ShellyBluPlatform] Error during auto-discovery: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (gateways.length === 0) {
      this.log.warn("[ShellyBluPlatform] No gateways configured or discovered");
      return;
    }

    this.log.info(`[ShellyBluPlatform] Discovered ${gateways.length} Shelly BLU TRV gateway(s)`);

    for (const gw of gateways) {
      if (!gw.devices || gw.devices.length === 0) {
        this.log.warn(`[ShellyBluPlatform] No TRVs configured for gateway ${gw.host}`);
        continue;
      }
      const api = new ShellyApi(gw, this.log);
      const pollMs = (gw.pollInterval ?? 60) * 1000;
      for (const trv of gw.devices) {
        const uuid = this.api.hap.uuid.generate(`${gw.host}-${trv.id}`);
        let acc = this.accessories.get(uuid);
        let trvAcc: ShellyTrvAccessory;
        const trvLabel = `${trv.name} (id=${trv.id})`;
        if (!acc) {
          this.log.info(`[ShellyBluPlatform] Adding new accessory: ${trvLabel}`);
          acc = new this.api.platformAccessory(trv.name, uuid);
          acc.context.device = trv;
          acc.context.gateway = gw;
          trvAcc = new ShellyTrvAccessory(this, acc, this.log);
          this.api.registerPlatformAccessories(
            PLATFORM_NAME,
            PLATFORM_NAME,
            [acc]
          );
          this.accessories.set(uuid, acc);
        } else {
          this.log.debug(`[ShellyBluPlatform] Accessory already cached: ${trvLabel}`);
          // If already exists, try to get the instance from map, or create if missing
          trvAcc = this.trvInstances.get(trv.id) || new ShellyTrvAccessory(this, acc, this.log);
        }
        this.trvInstances.set(trv.id, trvAcc);
        const poll = async () => {
          try {
            this.log.debug(`[ShellyBluPlatform] Polling state for ${trvLabel}`);
            const state = await api.getTrvState(trv.id);
            this.stateCache.set(trv.id, state);
            const stateStr = `🌡️ ${state.currentTemp}°C → ${state.targetTemp}°C | 💧${state.valve}% | 🔋${state.battery}% | ${state.online ? '🟢' : '🔴'}`;
            this.log.info(`[ShellyBluPlatform] Polled ${trvLabel} state: ${stateStr}`);
            trvAcc.updateFromState(state);
          } catch (error) {
            this.log.warn(`[ShellyBluPlatform] Failed to poll ${trvLabel}: ${error instanceof Error ? error.message : String(error)}`);
            this.stateCache.markOffline(trv.id);
          }
        };
        this.log.debug(`[ShellyBluPlatform] Starting polling for ${trvLabel} with interval ${pollMs}ms`);
        poll();
        setInterval(poll, pollMs);
      }
    }
  }
}
