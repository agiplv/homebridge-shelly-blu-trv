import { Logger, PlatformAccessory } from "homebridge";
import { ShellyBluPlatform } from "./platform";
import { ShellyApi } from "./shellyApi";

export class ShellyTrvAccessory {
  constructor(
    private readonly platform: ShellyBluPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly log: Logger
  ) {
    this.log.debug(`[${accessory.displayName}] Initializing TRV accessory`);
    const S = platform.api.hap.Service;
    accessory.getService(S.Thermostat) ?? accessory.addService(S.Thermostat);
    accessory.getService(S.Battery) ?? accessory.addService(S.Battery);
    this.log.debug(`[${accessory.displayName}] Services configured`);
    this.bind();
  }

  private bind() {
    const C = this.platform.api.hap.Characteristic;
    const S = this.platform.api.hap.Service;
    const t = this.accessory.getService(S.Thermostat)!;
    const b = this.accessory.getService(S.Battery)!;

    this.log.debug(`[${this.accessory.displayName}] Binding characteristics`);

    t.getCharacteristic(C.CurrentTemperature).onGet(() => {
      this.log.debug(`[${this.accessory.displayName}] Getting current temperature`);
      return this.get("currentTemp");
    });
    t.getCharacteristic(C.TargetTemperature)
      .onGet(() => {
        this.log.debug(`[${this.accessory.displayName}] Getting target temperature`);
        return this.get("targetTemp");
      })
      .onSet(v => {
        this.log.info(`[${this.accessory.displayName}] Setting target temperature to ${v}°C`);
        return this.setTarget(v as number);
      });

    t.getCharacteristic(C.CurrentRelativeHumidity).onGet(() => {
      this.log.debug(`[${this.accessory.displayName}] Getting valve position`);
      return this.get("valve");
    });
    b.getCharacteristic(C.BatteryLevel).onGet(() => {
      this.log.debug(`[${this.accessory.displayName}] Getting battery level`);
      return this.get("battery");
    });
  }

  private get(key: "currentTemp" | "targetTemp" | "valve" | "battery") {
    const id = this.accessory.context.device.id;
    const s = this.platform.stateCache.get(id);
    if (!s || !s.online) {
      this.log.warn(`[${this.accessory.displayName}] Device offline, unable to retrieve ${key}`);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
    // @ts-ignore - index access
    const value = s[key];
    this.log.debug(`[${this.accessory.displayName}] Retrieved ${key}: ${value}`);
    return value;
  }

  private async setTarget(value: number) {
    try {
      const api = new ShellyApi(this.accessory.context.gateway, this.log);
      this.log.debug(`[${this.accessory.displayName}] Sending target temperature ${value}°C to device`);
      await api.setTargetTemp(this.accessory.context.device.id, value);
      this.log.info(`[${this.accessory.displayName}] Successfully set target temperature to ${value}°C`);
    } catch (error) {
      this.log.error(`[${this.accessory.displayName}] Failed to set target temperature: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
