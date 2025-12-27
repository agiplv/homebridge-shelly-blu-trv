import { Logger } from "homebridge";
import { GatewayConfig, BluTrvDevice, TrvState } from "./types";

function buildUrl(host: string, path: string, token?: string) {
  const base = `http://${host}${path}`;
  return token ? `${base}?auth_key=${token}` : base;
}

export class ShellyApi {
  constructor(private readonly gw: GatewayConfig, private readonly log: Logger) {}
  private readonly requestTimeout = 5000;

  private async get(path: string) {
    const url = buildUrl(this.gw.host, path, this.gw.token);
    this.log.debug(`[ShellyApi] Fetching: ${this.gw.host}${path}`);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.requestTimeout)
      });
      if (!res.ok) {
        this.log.error(`[ShellyApi] HTTP ${res.status} from gateway ${this.gw.host}`);
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      this.log.debug(`[ShellyApi] Successfully fetched from ${this.gw.host}${path}`);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`[ShellyApi] Request failed to ${this.gw.host}: ${error.message}`);
      }
      throw error;
    }
  }

  async discoverTrvs(): Promise<BluTrvDevice[]> {
    this.log.debug(`[ShellyApi] Discovering TRVs from gateway ${this.gw.host}`);
    try {
      interface BleDevice { type?: string; id?: number; name?: string; battery?: number; online?: boolean }
      const status: { ble?: { devices?: BleDevice[] } } = await this.get("/status");
      const devices = status.ble?.devices ?? [];
      const trvs = devices
        .filter((d) => d.type === "trv")
        .map((d) => ({
          id: d.id ?? 0,
          name: d.name || `BLU TRV ${d.id ?? 'unknown'}`
        }));
      this.log.debug(`[ShellyApi] Found ${trvs.length} TRV(s) on gateway ${this.gw.host}`);
      return trvs;
    } catch (error) {
      this.log.error(`[ShellyApi] Failed to discover TRVs: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getTrvState(id: number): Promise<TrvState> {
    this.log.debug(`[ShellyApi] Fetching state for TRV ${id}`);
    try {
      interface RpcStatus { current_C: number; target_C: number; pos: number }
      const rpc: RpcStatus = await this.get(
        `/rpc/BluTrv.call&id=${id}&method=TRV.GetStatus`
      );

      const status: { ble?: { devices?: { id?: number; battery?: number; online?: boolean }[] } } = await this.get("/status");
      const dev = status.ble?.devices?.find((d) => d.id === id);

      const state = {
        currentTemp: rpc.current_C,
        targetTemp: rpc.target_C,
        valve: rpc.pos,
        battery: dev?.battery ?? 0,
        online: !!dev?.online
      };

      this.log.debug(`[ShellyApi] TRV ${id} state: temp=${state.currentTemp}°C, target=${state.targetTemp}°C, valve=${state.valve}%, battery=${state.battery}%, online=${state.online}`);
      return state;
    } catch (error) {
      this.log.error(`[ShellyApi] Failed to get TRV ${id} state: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async setTargetTemp(id: number, value: number) {
    this.log.debug(`[ShellyApi] Setting target temperature for TRV ${id} to ${value}°C`);
    try {
      await this.get(
        `/rpc/BluTrv.call&id=${id}&method=TRV.SetTarget&params=` +
        encodeURIComponent(JSON.stringify({ target_C: value }))
      );
      this.log.debug(`[ShellyApi] Successfully set target temperature for TRV ${id}`);
    } catch (error) {
      this.log.error(`[ShellyApi] Failed to set target temperature for TRV ${id}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
