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
    api.on("didFinishLaunching", () => this.discover());
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.set(accessory.UUID, accessory);
  }

  async discover() {
    for (const gw of (this.config.gateways ?? []) as GatewayConfig[]) {
      const api = new ShellyApi(gw);
      const pollMs = (gw.pollInterval ?? 60) * 1000;

      let trvs;
      try {
        trvs = await api.discoverTrvs();
      } catch {
        this.log.error(`Gateway ${gw.host} unreachable`);
        continue;
      }

      for (const trv of trvs) {
        const uuid = this.api.hap.uuid.generate(`${gw.host}-${trv.id}`);
        let acc = this.accessories.get(uuid);

        if (!acc) {
          acc = new this.api.platformAccessory(trv.name, uuid);
          acc.context.device = trv;
          acc.context.gateway = gw;
          new ShellyTrvAccessory(this, acc);
          this.api.registerPlatformAccessories(
            PLATFORM_NAME,
            PLATFORM_NAME,
            [acc]
          );
          this.accessories.set(uuid, acc);
        }

        const poll = async () => {
          try {
            this.stateCache.set(trv.id, await api.getTrvState(trv.id));
          } catch {
            this.stateCache.markOffline(trv.id);
          }
        };

        poll();
        setInterval(poll, pollMs);
      }
    }
  }
}
