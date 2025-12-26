import { PlatformAccessory } from "homebridge";
import { ShellyBluPlatform } from "./platform";
import { ShellyApi } from "./shellyApi";

export class ShellyTrvAccessory {
  constructor(
    private readonly platform: ShellyBluPlatform,
    private readonly accessory: PlatformAccessory
  ) {
    const S = platform.api.hap.Service;
    accessory.getService(S.Thermostat) ?? accessory.addService(S.Thermostat);
    accessory.getService(S.Battery) ?? accessory.addService(S.Battery);
    this.bind();
  }

  private bind() {
    const C = this.platform.api.hap.Characteristic;
    const S = this.platform.api.hap.Service;
    const t = this.accessory.getService(S.Thermostat)!;
    const b = this.accessory.getService(S.Battery)!;

    t.getCharacteristic(C.CurrentTemperature).onGet(() => this.get("currentTemp"));
    t.getCharacteristic(C.TargetTemperature)
      .onGet(() => this.get("targetTemp"))
      .onSet(v => this.setTarget(v as number));

    t.getCharacteristic(C.CurrentRelativeHumidity).onGet(() => this.get("valve"));
    b.getCharacteristic(C.BatteryLevel).onGet(() => this.get("battery"));
  }

  private get(key: "currentTemp" | "targetTemp" | "valve" | "battery") {
    const id = this.accessory.context.device.id;
    const s = this.platform.stateCache.get(id);
    if (!s || !s.online) {
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
    // @ts-ignore - index access
    return s[key];
  }

  private async setTarget(value: number) {
    const api = new ShellyApi(this.accessory.context.gateway);
    await api.setTargetTemp(this.accessory.context.device.id, value);
  }
}
