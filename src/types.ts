export const PLATFORM_NAME = "ShellyBluTRV";

export interface GatewayConfig {
  host: string;
  token?: string;
  pollInterval?: number;
  // Optional: manually specify TRV devices when discovery is not available
  devices?: BluTrvDevice[];
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
