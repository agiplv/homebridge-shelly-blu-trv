# Homebridge Shelly BLU TRV

[![CI](https://github.com/agiplv/homebridge-shelly-blu-trv/actions/workflows/ci.yml/badge.svg)](https://github.com/agiplv/homebridge-shelly-blu-trv/actions)

Homebridge plugin for Shelly BLU Thermostatic Radiator Valve (TRV) devices

# Homebridge Shelly BLU TRV Platform Plugin

Homebridge plugin for controlling Shelly BLU TRV (Thermostatic Radiator Valve) devices via a Shelly Plus/Pro Gateway. **Only manual device configuration is supported.**

## Features

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

Add the platform to your Homebridge `config.json`. You **must** specify each gateway and the list of TRVs to control. **Automatic discovery is not supported.**

```json
{
  "platform": "ShellyBluPlatform",
  "gateways": [
    {
      "host": "192.168.1.10",
      "token": "your-gateway-token",
      "pollInterval": 60,
      "devices": [
        { "id": 123, "name": "Living Room" },
        { "id": 456, "name": "Bedroom" }
      ]
    }
  ]
}
```

### Config Options

- `host` (string, required): IP or hostname of your Shelly Plus/Pro Gateway
- `token` (string, required): Gateway authentication token
- `pollInterval` (number, optional): Polling interval in seconds (default: 60)
- `devices` (array, required): List of TRVs to control. Each device must have:
  - `id` (number, required): TRV device ID (as shown in the Shelly app or web UI)
  - `name` (string, required): Name for HomeKit

**Note:** You must manually add each TRV you want to control. The plugin will not scan or discover devices automatically.

## Usage

Once configured, your Shelly BLU TRVs will appear in HomeKit as Thermostat accessories. You can control target temperature, view current temperature, battery, and valve state.

## Troubleshooting

- Ensure your Homebridge server can reach the Shelly Gateway and TRVs on the local network.
- Double-check the device IDs and gateway token.
- Check Homebridge logs for errors.


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
