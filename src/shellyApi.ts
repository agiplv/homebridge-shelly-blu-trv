import { GatewayConfig, BluTrvDevice, TrvState } from "./types";

function buildUrl(host: string, path: string, token?: string) {
  const base = `http://${host}${path}`;
  return token ? `${base}?auth_key=${token}` : base;
}

export class ShellyApi {
  constructor(private readonly gw: GatewayConfig) {}

  private async get(path: string) {
    const res = await fetch(
      buildUrl(this.gw.host, path, this.gw.token),
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async discoverTrvs(): Promise<BluTrvDevice[]> {
    const status = await this.get("/status");
    return (status.ble?.devices ?? [])
      .filter((d: any) => d.type === "trv")
      .map((d: any) => ({
        id: d.id,
        name: d.name || `BLU TRV ${d.id}`
      }));
  }

  async getTrvState(id: number): Promise<TrvState> {
    const rpc = await this.get(
      `/rpc/BluTrv.call&id=${id}&method=TRV.GetStatus`
    );

    const status = await this.get("/status");
    const dev = status.ble.devices.find((d: any) => d.id === id);

    return {
      currentTemp: rpc.current_C,
      targetTemp: rpc.target_C,
      valve: rpc.pos,
      battery: dev?.battery ?? 0,
      online: !!dev?.online
    };
  }

  async setTargetTemp(id: number, value: number) {
    await this.get(
      `/rpc/BluTrv.call&id=${id}&method=TRV.SetTarget&params=` +
      encodeURIComponent(JSON.stringify({ target_C: value }))
    );
  }
}
