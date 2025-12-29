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
    this.setupServices();
    this.log.debug(`[${accessory.displayName}] Services configured`);
    this.bindCharacteristics();
    // Set AccessoryInformation characteristics
    this.setAccessoryInformation();
  }

  private get S() { return this.platform.api.hap.Service; }
  private get C() { return this.platform.api.hap.Characteristic; }

  private getThermostat() {
    return this.accessory.getService(this.S.Thermostat)!;
  }

  private getBattery() {
    return this.accessory.getService(this.S.Battery)!;
  }

  private setupServices() {
    const thermostat = this.accessory.getService(this.S.Thermostat) ?? this.accessory.addService(this.S.Thermostat);
    const battery = this.accessory.getService(this.S.Battery) ?? this.accessory.addService(this.S.Battery);
    // Removed setProps for compatibility with test and production environments
    thermostat.getCharacteristic(this.C.CurrentHeatingCoolingState)
      .onGet(() => this.C.CurrentHeatingCoolingState.HEAT);
    thermostat.getCharacteristic(this.C.TargetHeatingCoolingState)
      .onGet(() => this.C.TargetHeatingCoolingState.HEAT)
      .onSet(() => {/* Only HEAT supported */});
    battery.getCharacteristic(this.C.StatusLowBattery)
      .onGet(() => this.C.StatusLowBattery.BATTERY_LEVEL_NORMAL);
  }

  private bindCharacteristics() {
    const t = this.getThermostat();
    const b = this.getBattery();
    t.getCharacteristic(this.C.CurrentTemperature).onGet(() => {
      this.log.debug(`[${this.accessory.displayName}] Getting current temperature`);
      return this.getStateValue("currentTemp");
    });
    t.getCharacteristic(this.C.TargetTemperature)
      .onGet(() => {
        this.log.debug(`[${this.accessory.displayName}] Getting target temperature`);
        return this.getStateValue("targetTemp");
      })
      .onSet(v => {
        this.log.info(`[${this.accessory.displayName}] Setting target temperature to ${v}°C`);
        return this.setTarget(v as number);
      });
    // Valve position as CurrentRelativeHumidity (Home app will show humidity icon)
    t.getCharacteristic(this.C.CurrentRelativeHumidity).onGet(() => {
      this.log.debug(`[${this.accessory.displayName}] Getting valve position`);
      return this.getStateValue("valve");
    });
    b.getCharacteristic(this.C.BatteryLevel).onGet(() => {
      this.log.debug(`[${this.accessory.displayName}] Getting battery level`);
      return this.getStateValue("battery");
    });
  }


  private getStateValue(key: keyof TrvState) {
    const id = this.accessory.context.device.id;
    const name = this.accessory.context.device.name || this.accessory.displayName;
    const s = this.platform.stateCache.get(id);
    if (!s) {
      this.log.debug(`[${name} | id=${id}] State not yet available, unable to retrieve '${key}'. Waiting for first poll.`);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
    if (!s.online) {
      this.log.warn(`[${name} | id=${id}] Device offline, unable to retrieve '${key}'.`);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
    const value = s[key];
    this.log.debug(`[${name} | id=${id}] Retrieved '${key}': ${value}`);
    return value;
  }

  private async setTarget(value: number) {
    const api = new ShellyApi(this.accessory.context.gateway, this.log);
    this.log.debug(`[${this.accessory.displayName}] Sending target temperature ${value}°C to device`);
    try {
      await api.setTargetTemp(this.accessory.context.device.id, value);
      const confirmedState = await this.confirmTargetTemperature(api, value);
      this.platform.stateCache.set(this.accessory.context.device.id, confirmedState);
      const stateStr = `🌡️ ${confirmedState.currentTemp}°C → ${confirmedState.targetTemp}°C | 💧${confirmedState.valve}% | 🔋${confirmedState.battery}% | ${confirmedState.online ? '🟢' : '🔴'}`;
      this.log.info(`[${this.accessory.displayName}] Target temperature set to ${value}°C, confirmed state: ${stateStr}`);
      this.updateFromState(confirmedState);
    } catch (error) {
      this.log.error(`[${this.accessory.displayName}] Failed to set target temperature: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async confirmTargetTemperature(api: ShellyApi, value: number): Promise<TrvState> {
    const maxTries = 10;
    const delayMs = 1000;
    for (let i = 0; i < maxTries; i++) {
      const state = await api.getTrvState(this.accessory.context.device.id);
      if (state.targetTemp === value) {
        return state;
      }
      await new Promise(res => setTimeout(res, delayMs));
    }
    this.log.warn(`[${this.accessory.displayName}] Target temperature not confirmed after ${maxTries} tries, using last state`);
    return await api.getTrvState(this.accessory.context.device.id);
  }

  /**
   * Pushes the latest state to Homebridge characteristics.
   * If offline, sets values to 0 and logs a warning.
   */
  updateFromState(state: TrvState) {
    const t = this.getThermostat();
    const b = this.getBattery();
    if (!state.online) {
      // Use NaN for offline, or a value outside valid range, to avoid confusion
      t.getCharacteristic(this.C.CurrentTemperature).updateValue(NaN);
      t.getCharacteristic(this.C.TargetTemperature).updateValue(NaN);
      t.getCharacteristic(this.C.CurrentRelativeHumidity).updateValue(0);
      b.getCharacteristic(this.C.BatteryLevel).updateValue(0);
      b.getCharacteristic(this.C.StatusLowBattery).updateValue(this.C.StatusLowBattery.BATTERY_LEVEL_LOW);
      t.getCharacteristic(this.C.CurrentHeatingCoolingState).updateValue(this.C.CurrentHeatingCoolingState.OFF);
      t.getCharacteristic(this.C.TargetHeatingCoolingState).updateValue(this.C.TargetHeatingCoolingState.OFF);
      this.log.warn(`[${this.accessory.displayName}] Device offline, set values to NaN/0/OFF`);
    } else {
      t.getCharacteristic(this.C.CurrentTemperature).updateValue(state.currentTemp);
      t.getCharacteristic(this.C.TargetTemperature).updateValue(state.targetTemp);
      t.getCharacteristic(this.C.CurrentRelativeHumidity).updateValue(state.valve);
      b.getCharacteristic(this.C.BatteryLevel).updateValue(state.battery);
      b.getCharacteristic(this.C.StatusLowBattery).updateValue(
        state.battery <= 20 ? this.C.StatusLowBattery.BATTERY_LEVEL_LOW : this.C.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
      t.getCharacteristic(this.C.CurrentHeatingCoolingState).updateValue(this.C.CurrentHeatingCoolingState.HEAT);
      t.getCharacteristic(this.C.TargetHeatingCoolingState).updateValue(this.C.TargetHeatingCoolingState.HEAT);
      const stateStr = `🌡️ ${state.currentTemp}°C → ${state.targetTemp}°C | 💧${state.valve}% | 🔋${state.battery}% | ${state.online ? '🟢' : '🔴'}`;
      this.log.debug(`[${this.accessory.displayName}] updateFromState: ${stateStr}`);
    }
  }

  /**
   * Fetch and set AccessoryInformation characteristics from device info
   */
  private async setAccessoryInformation() {
    const infoService = this.accessory.getService(this.S.AccessoryInformation) || this.accessory.addService(this.S.AccessoryInformation);
    try {
      const api = new ShellyApi(this.accessory.context.gateway, this.log);
      const id = this.accessory.context.device.id;
      const info = await api.getTrvDeviceInfo(id);
      infoService.setCharacteristic(this.C.Manufacturer, "Shelly");
      infoService.setCharacteristic(this.C.Model, info.model || "BluTRV");
      infoService.setCharacteristic(this.C.SerialNumber, info.id || info.mac || String(id));
      infoService.setCharacteristic(this.C.FirmwareRevision, info.ver || info.fw_id || "");
      this.log.info(`[${this.accessory.displayName}] Set AccessoryInformation: model=${info.model}, serial=${info.id}, fw=${info.ver}`);
    } catch (err) {
      this.log.warn(`[${this.accessory.displayName}] Could not fetch device info for AccessoryInformation: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
