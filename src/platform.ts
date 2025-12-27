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

export class ShellyBluPlatform implements DynamicPlatformPlugin {
  public readonly stateCache = new StateCache();
  private readonly accessories = new Map<string, PlatformAccessory>();

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
    const gateways = (this.config.gateways ?? []) as GatewayConfig[];
    if (gateways.length === 0) {
      this.log.warn("[ShellyBluPlatform] No gateways configured in config.json");
      return;
    }

    this.log.info(`[ShellyBluPlatform] Starting device discovery for ${gateways.length} gateway(s)`);

    for (const gw of gateways) {
      this.log.debug(`[ShellyBluPlatform] Discovering devices on gateway: ${gw.host}`);
      const api = new ShellyApi(gw, this.log);
      const pollMs = (gw.pollInterval ?? 60) * 1000;

      let trvs;
      try {
        trvs = await api.discoverTrvs();
        this.log.info(`[ShellyBluPlatform] Discovered ${trvs.length} TRV(s) on gateway ${gw.host}`);
        // If discovery returned nothing but user provided manual devices, use them
        if ((!trvs || trvs.length === 0) && gw.devices && gw.devices.length > 0) {
          this.log.warn(`[ShellyBluPlatform] Discovery returned no devices; using manual device list for gateway ${gw.host}`);
          trvs = gw.devices.map((d) => ({ id: d.id, name: d.name || `BLU TRV ${d.id}` }));
        }
      } catch (error) {
        if (gw.devices && gw.devices.length > 0) {
          this.log.warn(`[ShellyBluPlatform] Discovery failed for gateway ${gw.host}, using manual device list: ${error instanceof Error ? error.message : String(error)}`);
          trvs = gw.devices.map((d) => ({ id: d.id, name: d.name || `BLU TRV ${d.id}` }));
        } else {
          this.log.error(`[ShellyBluPlatform] Failed to discover devices on gateway ${gw.host}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
      }

      for (const trv of trvs) {
        const uuid = this.api.hap.uuid.generate(`${gw.host}-${trv.id}`);
        let acc = this.accessories.get(uuid);

        if (!acc) {
          this.log.info(`[ShellyBluPlatform] Adding new accessory: ${trv.name} (ID: ${trv.id})`);
          acc = new this.api.platformAccessory(trv.name, uuid);
          acc.context.device = trv;
          acc.context.gateway = gw;
          new ShellyTrvAccessory(this, acc, this.log);
          this.api.registerPlatformAccessories(
            PLATFORM_NAME,
            PLATFORM_NAME,
            [acc]
          );
          this.accessories.set(uuid, acc);
        } else {
          this.log.debug(`[ShellyBluPlatform] Accessory already cached: ${trv.name}`);
        }

        const poll = async () => {
          try {
            this.log.debug(`[ShellyBluPlatform] Polling state for TRV ${trv.id}`);
            this.stateCache.set(trv.id, await api.getTrvState(trv.id));
          } catch (error) {
            this.log.warn(`[ShellyBluPlatform] Failed to poll TRV ${trv.id}: ${error instanceof Error ? error.message : String(error)}`);
            this.stateCache.markOffline(trv.id);
          }
        };

        this.log.debug(`[ShellyBluPlatform] Starting polling for TRV ${trv.id} with interval ${pollMs}ms`);
        poll();
        setInterval(poll, pollMs);
      }
    }
  }
}
