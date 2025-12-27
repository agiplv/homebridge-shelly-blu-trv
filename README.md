# Homebridge Shelly BLU TRV

[![CI](https://github.com/agiplv/homebridge-shelly-blu-trv/actions/workflows/ci.yml/badge.svg)](https://github.com/agiplv/homebridge-shelly-blu-trv/actions)

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

Install via npm:

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

---

## Development

- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test`

Contributions welcome — open an issue or a pull request.

---

## Local testing

To test the plugin locally in a running Homebridge instance:

- Build a tarball: `npm pack`
- Install into Homebridge (on same machine): `npm i -g ./homebridge-shelly-blu-trv-<version>.tgz` or upload the tarball in Homebridge UI as a plugin file.

To test in a development Homebridge container, you can mount the packed tarball or install from the working directory with `npm i -g` after `npm run build`.

## Publishing

Automatic publishing is configured to run on new GitHub releases (see `.github/workflows/publish.yml`).
To publish manually:

1. Ensure you're logged in to npm (`npm login`).
2. Build the package: `npm run build`.
3. Bump the version and push tags, or run `npm version <patch|minor|major>` and push tags.
4. Publish: `npm publish --access public`.

If you'd like automated semantic releases, I can add `semantic-release` config and a workflow.

## License

MIT © agiplv
