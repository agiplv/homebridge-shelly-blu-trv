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
    const gateways = (this.config.gateways ?? []) as GatewayConfig[];
    if (gateways.length === 0) {
      this.log.warn("[ShellyBluPlatform] No gateways configured in config.json");
      return;
    }

    this.log.info(`[ShellyBluPlatform] Registering manually configured TRVs for ${gateways.length} gateway(s)`);

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
        if (!acc) {
          this.log.info(`[ShellyBluPlatform] Adding new accessory: ${trv.name} (ID: ${trv.id})`);
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
          this.log.debug(`[ShellyBluPlatform] Accessory already cached: ${trv.name}`);
          // If already exists, try to get the instance from map, or create if missing
          trvAcc = this.trvInstances.get(trv.id) || new ShellyTrvAccessory(this, acc, this.log);
        }
        this.trvInstances.set(trv.id, trvAcc);
      }
    }
  }
}
