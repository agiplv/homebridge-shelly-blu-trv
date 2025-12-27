import { Logger } from "homebridge";
import { GatewayConfig, BluTrvDevice, TrvState } from "./types";

function buildUrl(host: string, path: string, token?: string) {
  const base = `http://${host}${path}`;
  return token ? `${base}?auth_key=${token}` : base;
}

export class ShellyApi {
  constructor(private readonly gw: GatewayConfig, private readonly log: Logger) {}
  private readonly requestTimeout = 60000; // 1 minute timeout

  private async get(path: string) {
    const url = buildUrl(this.gw.host, path, this.gw.token);
    this.log.debug(`[ShellyApi] Fetching: ${this.gw.host}${path}`);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.requestTimeout)
      });
      if (!res.ok) {
        // Try to extract body text for better diagnostics
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch {
          bodyText = '<no body>';
        }
        this.log.error(`[ShellyApi] HTTP ${res.status} from gateway ${this.gw.host}${path} - ${bodyText}`);
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }
      const data = await res.json();
      this.log.debug(`[ShellyApi] Successfully fetched from ${this.gw.host}${path}`);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`[ShellyApi] Request failed to ${this.gw.host}${path}: ${error.message}`);
      }
      throw error;
    }
  }

  private async rpcCall(id: number, method: string, params?: unknown) {
    // Try several RPC variants for wider compatibility with firmware differences
    const quotedMethod = `"${method}"`;
    const paramsStr = params ? `&params=${encodeURIComponent(JSON.stringify(params))}` : '';

    // Try direct GetStatus endpoints first (some firmwares expose dedicated GET endpoints)
    const candidates: string[] = [];
    if (method === 'TRV.GetStatus') {
      candidates.push(`/rpc/BluTrv.GetStatus?id=${id}`);
      candidates.push(`/rpc/BluTrv.GetStatus&id=${id}`);
    }

    // Common CALL variants (different firmware use call vs Call and different query separators)
    candidates.push(`/rpc/BluTrv.Call?id=${id}&method=${quotedMethod}${paramsStr}`);
    candidates.push(`/rpc/BluTrv.call?id=${id}&method=${quotedMethod}${paramsStr}`);
    candidates.push(`/rpc/BluTrv.Call&id=${id}&method=${quotedMethod}${paramsStr}`);
    candidates.push(`/rpc/BluTrv.call&id=${id}&method=${quotedMethod}${paramsStr}`);

    for (const path of candidates) {
      try {
        return await this.get(path);
      } catch (err) {
        // If 404, try next candidate; otherwise propagate
        if (err instanceof Error && err.message.includes('HTTP 404')) {
          this.log.debug(`[ShellyApi] RPC variant failed (404), trying next: ${path}`);
          continue;
        }
        throw err;
      }
    }

    // Fallback: try POST to /rpc/BluTrv.call with JSON body
    try {
      const url = buildUrl(this.gw.host, '/rpc/BluTrv.call', this.gw.token);
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ id, method, params }),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.requestTimeout)
      });
      if (!res.ok) {
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch {
          bodyText = '<no body>';
        }
        this.log.error(`[ShellyApi] HTTP ${res.status} from gateway ${this.gw.host} (POST /rpc/BluTrv.call): ${bodyText}`);
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }
      return res.json();
    } catch (err) {
      this.log.error(`[ShellyApi] RPC call failed for TRV ${id} method ${method}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }


  async getTrvState(id: number): Promise<TrvState> {
    this.log.debug(`[ShellyApi] Fetching state for TRV ${id}`);
    try {
      interface RpcStatus { current_C: number; target_C: number; pos: number }
      // Only use direct RPC response; no /status fallback
      const rpcAny: any = await this.rpcCall(id, 'TRV.GetStatus');
      const rpc: RpcStatus & { battery?: number; paired?: boolean; online?: boolean } = rpcAny;

      // Validate required fields
      if (
        typeof rpc.current_C !== 'number' ||
        typeof rpc.target_C !== 'number' ||
        typeof rpc.pos !== 'number'
      ) {
        throw new Error(`Missing required TRV state fields in RPC response: ${JSON.stringify(rpc)}`);
      }

      // Use battery/online from RPC response if present, else default
      const battery: number = typeof rpc.battery === 'number' ? rpc.battery : 0;
      // Accept either paired or online as online indicator
      const online: boolean = typeof rpc.online === 'boolean' ? rpc.online : (typeof rpc.paired === 'boolean' ? rpc.paired : true);

      const state = {
        currentTemp: rpc.current_C,
        targetTemp: rpc.target_C,
        valve: rpc.pos,
        battery,
        online
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
    const maxAttempts = 5;
    const retryDelay = 3000; // 3 seconds between retries
    let lastError: unknown = null;
    const startTime = Date.now();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Include an explicit id:0 in params (observed in some firmware examples)
        await this.rpcCall(id, 'TRV.SetTarget', { id: 0, target_C: value });
        this.log.debug(`[ShellyApi] Successfully set target temperature for TRV ${id} (attempt ${attempt})`);
        // Requery and return the updated state
        return await this.getTrvState(id);
      } catch (error) {
        lastError = error;
        this.log.warn(`[ShellyApi] Attempt ${attempt} to set target temperature for TRV ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
        if (Date.now() - startTime > this.requestTimeout) {
          this.log.error(`[ShellyApi] setTargetTemp timed out after ${this.requestTimeout}ms for TRV ${id}`);
          break;
        }
        if (attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, retryDelay));
        }
      }
    }
    this.log.error(`[ShellyApi] Failed to set target temperature for TRV ${id} after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    throw lastError;
  }
}
