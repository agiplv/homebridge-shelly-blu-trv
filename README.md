# Homebridge Shelly BLU TRV

Homebridge plugin for Shelly BLU Thermostatic Radiator Valve (TRV) devices
via the Shelly BLU Gateway Gen3.

This plugin exposes BLU TRV devices to Apple HomeKit using a local Shelly BLU
Gateway Gen3. It supports current temperature, target temperature control,
valve position, battery level and offline detection.

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

## Configuration (Homebridge UI)

Add the platform under `platforms` in Homebridge configuration. Example:

```json
{
  "platforms": [
    {
      "platform": "ShellyBluTRV",
      "gateways": [
        {
          "host": "192.168.1.50",
          "token": "<optional-auth-token>",
          "pollInterval": 60
        }
      ]
    }
  ]
}
```

Notes:

- Auth token is optional.
- Valve position is reported as 0–100% (read-only).
- Offline TRVs are shown as “Not Responding” in HomeKit.

## License

MIT
