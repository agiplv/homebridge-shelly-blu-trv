import { Logger } from "homebridge";
import { Bonjour } from "bonjour-service";
import { DiscoveredGateway } from "./types";

export class ShellyDiscovery {
  constructor(private readonly log: Logger) {}

  private async checkBluGateway(ip: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      
      const res = await fetch(`http://${ip}/rpc/BluGw.GetStatus`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!res.ok) return false;
      const response = await res.json();
      return !response.code;
    } catch {
      return false;
    }
  }

  private async getComponents(ip: string): Promise<any> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      
      const res = await fetch(`http://${ip}/rpc/Shelly.GetComponents`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async discoverGateways(timeoutMs = 5000): Promise<DiscoveredGateway[]> {
    const bonjour = new Bonjour();
    const foundIPs = new Set<string>();
    const results: DiscoveredGateway[] = [];

    this.log.info("[Discovery] Starting mDNS discovery for Shelly BLU Gateways...");

    return new Promise((resolve) => {
      const browser = bonjour.find({ type: "http" });

      browser.on("up", async (service: any) => {
        if (service.name && service.name.toLowerCase().includes("shelly")) {
          const ip = service.referer?.address || service.addresses?.[0];
          
          if (ip && !foundIPs.has(ip)) {
            foundIPs.add(ip);
            this.log.debug(`[Discovery] Checking Shelly device at ${ip}...`);
            
            const isBluGateway = await this.checkBluGateway(ip);
            if (isBluGateway) {
              const components = await this.getComponents(ip);
              const trvIds: number[] = [];
              
              if (components?.components) {
                for (const comp of components.components) {
                  if (comp.key?.startsWith("blutrv:")) {
                    trvIds.push(parseInt(comp.key.split(":")[1]));
                  }
                }
              }
              
              results.push({ host: ip, trvIds });
              this.log.info(`[Discovery] Found BLU Gateway at ${ip} with ${trvIds.length} TRV(s): ${trvIds.join(", ")}`);
            } else {
              this.log.debug(`[Discovery] ${ip} is not a BLU Gateway`);
            }
          }
        }
      });

      setTimeout(() => {
        browser.stop();
        bonjour.destroy();
        this.log.info(`[Discovery] Finished. Found ${results.length} BLU Gateway(s).`);
        resolve(results);
      }, timeoutMs);
    });
  }
}
