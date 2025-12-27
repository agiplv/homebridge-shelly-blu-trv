import { Logger, PlatformAccessory } from "homebridge";
import { ShellyBluPlatform } from "./platform";
import { ShellyApi } from "./shellyApi";
import { TrvState } from "./types";

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

    t.getCharacteristic(C.CurrentTemperature).onGet(async () => {
      this.log.debug(`[${this.accessory.displayName}] Getting current temperature (fetching from device)`);
      await this.refreshState();
      return this.get("currentTemp");
    });
    t.getCharacteristic(C.TargetTemperature)
      .onGet(async () => {
        this.log.debug(`[${this.accessory.displayName}] Getting target temperature (fetching from device)`);
        await this.refreshState();
        return this.get("targetTemp");
      })
      .onSet(v => {
        this.log.info(`[${this.accessory.displayName}] Setting target temperature to ${v}°C`);
        return this.setTarget(v as number);
      });

    t.getCharacteristic(C.CurrentRelativeHumidity).onGet(async () => {
      this.log.debug(`[${this.accessory.displayName}] Getting valve position (fetching from device)`);
      await this.refreshState();
      return this.get("valve");
    });
    b.getCharacteristic(C.BatteryLevel).onGet(async () => {
      this.log.debug(`[${this.accessory.displayName}] Getting battery level (fetching from device)`);
      await this.refreshState();
      return this.get("battery");
    });

  }

  /**
   * Fetches the latest state from the device and updates the cache and Homebridge.
   */
  private async refreshState() {
    try {
      const api = new ShellyApi(this.accessory.context.gateway, this.log);
      const state = await api.getTrvState(this.accessory.context.device.id);
      this.platform.stateCache.set(this.accessory.context.device.id, state);
      this.updateFromState(state);
    } catch (error) {
      this.log.error(`[${this.accessory.displayName}] Failed to refresh state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private get(key: keyof TrvState) {
    const id = this.accessory.context.device.id;
    const s = this.platform.stateCache.get(id);
    if (!s || !s.online) {
      this.log.warn(`[${this.accessory.displayName}] Device offline, unable to retrieve ${key}`);
      this.updateFromState({ currentTemp: 0, targetTemp: 0, valve: 0, battery: 0, online: false });
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
    const value = s[key];
    this.log.debug(`[${this.accessory.displayName}] Retrieved ${key}: ${value}`);
    return value;
  }

  private async setTarget(value: number) {
    try {
      const api = new ShellyApi(this.accessory.context.gateway, this.log);
      this.log.debug(`[${this.accessory.displayName}] Sending target temperature ${value}°C to device`);
      await api.setTargetTemp(this.accessory.context.device.id, value);
      // Wait for confirmation that the device state matches the new target
      const maxTries = 10;
      const delayMs = 1000;
      let confirmedState: TrvState | null = null;
      for (let i = 0; i < maxTries; i++) {
        const state = await api.getTrvState(this.accessory.context.device.id);
        if (state.targetTemp === value) {
          confirmedState = state;
          break;
        }
        await new Promise(res => setTimeout(res, delayMs));
      }
      if (!confirmedState) {
        this.log.warn(`[${this.accessory.displayName}] Target temperature not confirmed after ${maxTries} tries, using last state`);
        confirmedState = await api.getTrvState(this.accessory.context.device.id);
      }
      this.platform.stateCache.set(this.accessory.context.device.id, confirmedState);
      this.log.info(`[${this.accessory.displayName}] Target temperature set to ${value}°C, confirmed state: ${JSON.stringify(confirmedState)}`);
      this.updateFromState(confirmedState);
    } catch (error) {
      this.log.error(`[${this.accessory.displayName}] Failed to set target temperature: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Pushes the latest state to Homebridge characteristics.
   * If offline, sets values to 0 and logs a warning.
   */
  updateFromState(state: TrvState) {
    const C = this.platform.api.hap.Characteristic;
    const S = this.platform.api.hap.Service;
    const t = this.accessory.getService(S.Thermostat)!;
    const b = this.accessory.getService(S.Battery)!;
    if (!state.online) {
      t.getCharacteristic(C.CurrentTemperature).updateValue(0);
      t.getCharacteristic(C.TargetTemperature).updateValue(0);
      t.getCharacteristic(C.CurrentRelativeHumidity).updateValue(0);
      b.getCharacteristic(C.BatteryLevel).updateValue(0);
      this.log.warn(`[${this.accessory.displayName}] Device offline, set all values to 0`);
    } else {
      t.getCharacteristic(C.CurrentTemperature).updateValue(state.currentTemp);
      t.getCharacteristic(C.TargetTemperature).updateValue(state.targetTemp);
      t.getCharacteristic(C.CurrentRelativeHumidity).updateValue(state.valve);
      b.getCharacteristic(C.BatteryLevel).updateValue(state.battery);
      this.log.debug(`[${this.accessory.displayName}] updateFromState: ${JSON.stringify(state)}`);
    }
  }
}
