# Homebridge Shelly BLU TRV

[![CI](https://github.com/agiplv/homebridge-shelly-blu-trv/actions/workflows/ci.yml/badge.svg)](https://github.com/agiplv/homebridge-shelly-blu-trv/actions)

Homebridge plugin for Shelly BLU Thermostatic Radiator Valve (TRV) devices

# Homebridge Shelly BLU TRV Platform Plugin

Homebridge plugin for controlling Shelly BLU TRV (Thermostatic Radiator Valve) devices via a Shelly Plus/Pro Gateway.

## Features

- **Automatic Discovery**: Discovers Shelly BLU Gateways on your local network via mDNS
- **Manual Configuration**: Optionally specify gateways and devices manually
- Control Shelly BLU TRV devices from HomeKit
- Direct communication with TRVs (no cloud)
- Battery, temperature, and valve state reporting
- Fast polling and state updates

## Requirements

- Homebridge v1.6+
- Node.js v18+
- Shelly Plus/Pro Gateway (with local network access)
- Shelly BLU TRV devices

## Installation

Install via Homebridge UI or npm:

```sh
npm install -g homebridge-shelly-blu-trv
```

## Configuration

The plugin supports both **automatic discovery** and **manual configuration** of gateways.

### Auto-Discovery (Default)

By default, the plugin automatically discovers Shelly BLU Gateways on your local network using mDNS. No manual configuration required:

```json
{
  "platform": "ShellyBluPlatform"
}
```

Discovered gateways and their TRVs will appear in HomeKit with default names like `TRV 123`. You can rename them in HomeKit as needed.

**Note:** Discovered TRVs will also appear in the Homebridge logs with emoji state indicators (🌡️ temperature, 💧 humidity, 🔋 battery, 🟢 status).

### Manual Configuration

If auto-discovery doesn't work or you prefer to manually specify devices, add gateways and TRV device IDs:

```json
{
  "platform": "ShellyBluPlatform",
  "enableAutoDiscovery": false,
  "gateways": [
    {
      "host": "192.168.1.10",
      "pollInterval": 60,
      "devices": [
        { "id": 123, "name": "Living Room" },
        { "id": 456, "name": "Bedroom" }
      ]
    }
  ]
}
```

### Mixed Mode

You can combine auto-discovery with manual configuration. Auto-discovered gateways will be merged with your manual configuration, and duplicates will be automatically avoided:

```json
{
  "platform": "ShellyBluPlatform",
  "enableAutoDiscovery": true,
  "gateways": [
    {
      "host": "192.168.1.15",
      "pollInterval": 30,
      "devices": [
        { "id": 789, "name": "Kitchen" }
      ]
    }
  ]
}
```

### Config Options

**Platform-level:**
- `enableAutoDiscovery` (boolean, optional): Enable mDNS discovery of gateways (default: `true`)

**Gateway-level:**
- `host` (string, required): IP or hostname of your Shelly Plus/Pro Gateway
- `pollInterval` (number, optional): Polling interval in seconds (default: 60)
- `devices` (array, optional): List of TRVs to control. Each device must have:
  - `id` (number, required): TRV device ID (as shown in the Shelly app or web UI)
  - `name` (string, required): Name for HomeKit

## Usage

Once configured, your Shelly BLU TRVs will appear in HomeKit as Thermostat accessories. You can control target temperature, view current temperature, battery, and valve state.

## Troubleshooting

### Auto-Discovery Issues

- **No devices appear automatically**: Ensure your Homebridge server and Shelly Gateways are on the same network and mDNS is enabled
- **Gateways discovered but no TRVs appear**: Check that TRVs are properly paired with the gateway in the Shelly app
- **Slow discovery**: Discovery waits up to 5 seconds for responses; consider using manual configuration if mDNS is unreliable

### General Issues

- Ensure your Homebridge server can reach the Shelly Gateway and TRVs on the local network
- Double-check the device IDs (if using manual configuration)
- Check Homebridge logs for errors


## Development & Testing

Run unit tests with:

```sh
npm test
```

To check coverage:

```sh
npm run check-coverage
```
The default threshold is 80% lines (set `COVERAGE_THRESHOLD` env to override).

## License

MIT



## Publishing

- The repository contains a publish workflow (`.github/workflows/publish.yml`) that runs when a GitHub Release is created and performs an `npm publish` step.

Manual publish steps:
1. Ensure you're logged in to npm: `npm login`.
2. Build the package: `npm run build`.
3. Bump the package version (e.g. `npm version patch`) and push the tag.
4. Create a GitHub Release (or run `npm publish --access public` manually).

For CI-based publishing, set the repository secret `NPM_TOKEN` to a valid npm automation token with publish rights. See the npm docs for details on creating and using automation tokens.

## License

MIT © agiplv
