# Homebridge Shelly BLU TRV

**Homebridge plugin for Shelly BLU Thermostatic Radiator Valve (TRV) devices  
via the Shelly BLU Gateway Gen3**

This plugin exposes Shelly BLU TRV devices to Apple HomeKit using a local Shelly BLU Gateway Gen3.  
It supports temperature sensing, target temperature control, valve position, and battery monitoring.

## 🛠️ Features

✔ Read **current temperature**  
✔ Control **target temperature**  
✔ Show **valve position** (0–100 %)  
✔ Show **battery level**  
✔ Works locally via **Shelly BLU Gateway Gen3 HTTP RPC API** :contentReference[oaicite:0]{index=0}

---

## 📦 Installation

# Homebridge Shelly BLU TRV

Expose Shelly BLU TRV thermostats to Apple HomeKit using Homebridge.

## Features
- BLU TRV discovery via Shelly BLU Gateway Gen3
- Current temperature
- Target temperature control
- Valve position (percent)
- Battery level
- Offline detection
- Multiple gateways

## Requirements
- Node.js 18+
- Homebridge 1.6+
- Shelly BLU Gateway Gen3
- Shelly BLU TRV

## Installation
```bash
npm install -g homebridge-shelly-blu-trv
```

Configuration

Use Homebridge UI → Plugins → Shelly BLU TRV

{
  "platforms": [
    {
      "platform": "ShellyBluTRV",
      "gateways": [
        {
          "host": "192.168.1.50",
          "pollInterval": 60
        }
      ]
    }
  ]
}

Notes
	•	Auth token is optional
	•	Valve position is reported as 0–100%
	•	Offline TRVs show as “Not Responding”

License

MIT
