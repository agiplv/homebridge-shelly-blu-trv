export const PLATFORM_NAME = "ShellyBluTRV";

export interface GatewayConfig {
  host: string;
  pollInterval?: number;
  devices: BluTrvDevice[];
}

export interface BluTrvDevice {
  id: number;
  name: string;
}

export interface TrvState {
  currentTemp: number;
  targetTemp: number;
  valve: number;
  battery: number;
  online: boolean;
}
