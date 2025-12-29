import { Logger } from "homebridge";
import { GatewayConfig, BluTrvDevice, TrvState } from "./types";


function buildUrl(host: string, path: string) {
  return `http://${host}${path}`;
}

function logPrefix(host: string) {
  return `[ShellyApi][${host}]`;
}

export class ShellyApi {
  constructor(private readonly gw: GatewayConfig, private readonly log: Logger) {}
  private readonly requestTimeout = 60000; // 1 minute timeout

  private async get(path: string) {
    const url = buildUrl(this.gw.host, path);
    this.log.debug(`${logPrefix(this.gw.host)} Fetching: ${path}`);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.requestTimeout)
      });
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch { bodyText = '<no body>'; }
        this.log.error(`${logPrefix(this.gw.host)} HTTP ${res.status} ${path} - ${bodyText}`);
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }
      const data = await res.json();
      this.log.debug(`${logPrefix(this.gw.host)} Success: ${path}`);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`${logPrefix(this.gw.host)} Request failed: ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  private async rpcCall(id: number, method: string, params?: unknown) {
    const quotedMethod = `"${method}"`;
    const paramsStr = params ? `&params=${encodeURIComponent(JSON.stringify(params))}` : '';
    const candidates: string[] = [];
    if (method === 'TRV.GetStatus') {
      candidates.push(`/rpc/BluTrv.GetStatus?id=${id}`);
      candidates.push(`/rpc/BluTrv.GetStatus&id=${id}`);
    }
    candidates.push(`/rpc/BluTrv.Call?id=${id}&method=${quotedMethod}${paramsStr}`);
    candidates.push(`/rpc/BluTrv.call?id=${id}&method=${quotedMethod}${paramsStr}`);
    candidates.push(`/rpc/BluTrv.Call&id=${id}&method=${quotedMethod}${paramsStr}`);
    candidates.push(`/rpc/BluTrv.call&id=${id}&method=${quotedMethod}${paramsStr}`);

    for (const path of candidates) {
      try {
        return await this.get(path);
      } catch (err) {
        if (err instanceof Error && err.message.includes('HTTP 404')) {
          this.log.debug(`${logPrefix(this.gw.host)} RPC variant failed (404), trying next: ${path}`);
          continue;
        }
        throw err;
      }
    }

    // Fallback: try POST to /rpc/BluTrv.call with JSON body
    try {
      const url = buildUrl(this.gw.host, '/rpc/BluTrv.call');
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ id, method, params }),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.requestTimeout)
      });
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch { bodyText = '<no body>'; }
        this.log.error(`${logPrefix(this.gw.host)} HTTP ${res.status} (POST /rpc/BluTrv.call): ${bodyText}`);
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }
      return res.json();
    } catch (err) {
      this.log.error(`${logPrefix(this.gw.host)} RPC call failed for TRV ${id} method ${method}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // Helper for retrying an async operation with delay and timeout
  private async retry<T>(fn: () => Promise<T>, maxAttempts: number, delayMs: number, timeoutMs: number, onError?: (err: unknown, attempt: number) => void): Promise<T> {
    const startTime = Date.now();
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (onError) onError(err, attempt);
        if (Date.now() - startTime > timeoutMs) break;
        if (attempt < maxAttempts) await new Promise(res => setTimeout(res, delayMs));
      }
    }
    // Final failure log for visibility
    if (lastError) {
      this.log.error(`[ShellyApi][${this.gw.host}] All ${maxAttempts} retry attempts failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    }
    throw lastError;
  }


  async getTrvState(id: number): Promise<TrvState> {
    this.log.debug(`${logPrefix(this.gw.host)} Fetching state for TRV ${id}`);
    try {
      type RpcStatus = { current_C: number; target_C: number; pos: number; battery?: number; paired?: boolean; online?: boolean };
      const rpc: RpcStatus = await this.rpcCall(id, 'TRV.GetStatus');
      if (
        typeof rpc.current_C !== 'number' ||
        typeof rpc.target_C !== 'number' ||
        typeof rpc.pos !== 'number'
      ) {
        throw new Error(`Missing required TRV state fields in RPC response: ${JSON.stringify(rpc)}`);
      }
      const battery: number = typeof rpc.battery === 'number' ? rpc.battery : 0;
      const online: boolean = typeof rpc.online === 'boolean' ? rpc.online : (typeof rpc.paired === 'boolean' ? rpc.paired : true);
      const state: TrvState = {
        currentTemp: rpc.current_C,
        targetTemp: rpc.target_C,
        valve: rpc.pos,
        battery,
        online
      };
      this.log.debug(`${logPrefix(this.gw.host)} TRV ${id} state: temp=${state.currentTemp}°C, target=${state.targetTemp}°C, valve=${state.valve}%, battery=${state.battery}%, online=${state.online}`);
      return state;
    } catch (error) {
      this.log.error(`${logPrefix(this.gw.host)} Failed to get TRV ${id} state: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async setTargetTemp(id: number, value: number) {
    this.log.debug(`${logPrefix(this.gw.host)} Setting target temperature for TRV ${id} to ${value}°C`);
    const maxAttempts = 5;
    const retryDelay = 3000;
    // Try to get device name from gateway config if available
    const trvName = (this.gw.devices?.find?.((d: any) => d.id === id)?.name) || `TRV ${id}`;
    return this.retry(async () => {
      // Include an explicit id:0 in params (observed in some firmware examples)
      await this.rpcCall(id, 'TRV.SetTarget', { id: 0, target_C: value });
      this.log.debug(`${logPrefix(this.gw.host)} Successfully set target temperature for ${trvName} (id=${id})`);
      return await this.getTrvState(id);
    }, maxAttempts, retryDelay, this.requestTimeout, (err, attempt) => {
      this.log.warn(`${logPrefix(this.gw.host)} Attempt ${attempt} to set target temperature for ${trvName} (id=${id}) failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}
