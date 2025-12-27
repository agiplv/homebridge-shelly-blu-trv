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

Run tests with:

```sh
npm test
```

## License

MIT

We include a simple fake Shelly BLU gateway and an E2E runner to validate discovery and polling locally:

- Start the fake gateway + headless Homebridge locally: `npm run e2e` (the script builds the project and runs the fake gateway + Homebridge, it times out after ~60s if discovery/polling isn't observed).
- The repository also includes a GitHub Actions workflow `.github/workflows/e2e.yml` that runs the same test in CI.

### Coverage check

To ensure coverage is sufficient:

- Run tests with coverage: `npm test`
- Check coverage threshold (lines): `npm run check-coverage` (configured to require at least 80% lines by default, set `COVERAGE_THRESHOLD` env to override)


## Publishing

### Manual device configuration (fallback when discovery unavailable) ✅

If your Shelly BLU Gateway Gen3 does not expose the `/status` discovery endpoint (returns 404) or discovery is otherwise unavailable, you can manually configure TRV devices in the gateway entry of your Homebridge config. The plugin will use this list when discovery fails or returns no devices.

Example gateway configuration with manual devices:

```json
{
  "platforms": [
    {
      "platform": "ShellyBluTRV",
      "gateways": [
        {
          "host": "10.0.0.171",
          "token": "<optional-auth-token>",
          "pollInterval": 60,
          "devices": [
            { "id": 100, "name": "Living TRV" },
            { "id": 101, "name": "Kitchen TRV" }
          ]
        }
      ]
    }
  ]
}
```

Notes:

- `id` is the TRV numeric id assigned by the gateway; the plugin uses this id for polling and state updates.
- If `name` is omitted, a default name `BLU TRV <id>` will be used.
- When both discovery and manual `devices` are available, discovery takes precedence.

## Publishing

- The repository contains two publishing workflows:
  - **Publish** (`.github/workflows/publish.yml`) — runs when a GitHub Release is *created* and performs an `npm publish` step.
  - **Semantic Release** (`.github/workflows/semantic-release.yml`) — when enabled, automatically creates releases, changelogs and publishes to npm on `main` via `semantic-release`.

**NOTE:** The automatic semantic-release runs are currently **paused** (workflow trigger switched to `workflow_dispatch`). To run it manually: go to the Actions tab → **Semantic Release** → **Run workflow** (choose `main`).

Manual publish steps

1. Ensure you're logged in to npm: `npm login`.
2. Build the package: `npm run build`.
3. Bump the package version (e.g. `npm version patch`) and push the tag.
4. Create a GitHub Release (or run `npm publish --access public` manually).

Developer notes about `NPM_TOKEN` and automation

- For CI-based publishing you must set the repository secret `NPM_TOKEN` (Settings → Secrets → Actions) to a valid **npm automation token** with publish rights.
  - Create it on npm: Settings → Access Tokens → **Create New Token** → choose **Automation** and ensure it has publish rights.
  - If your npm account uses Two-Factor Authentication (2FA), pick a token that is usable for CI (set 2FA to **Authorization only** for automation tokens). See https://docs.npmjs.com/getting-started/working_with_tokens for details.
- If semantic-release reports `EINVALIDNPMTOKEN` or `401 Unauthorized`, try re-creating the token and updating `NPM_TOKEN` in repo secrets.
- The repository also includes a Publish workflow (triggered on Release creation) which can publish even if semantic-release is paused — this is useful for one-off releases.

E2E and local verification (developer)

- Run the E2E runner locally: `npm run e2e` — this will install deps, build the project, install a local shim, start the fake gateway and a headless Homebridge instance and look for discovery/polling logs.
- Run unit tests + coverage: `npm test` (creates `coverage/lcov.info` and an `lcov-report` directory).
- Check coverage threshold: `npm run check-coverage` (defaults to 80% lines; use `COVERAGE_THRESHOLD` to override).

If you'd like, I can add a small diagnostic Action that runs `npm whoami` using `NPM_TOKEN` (safely) so you can quickly confirm which npm account the token maps to before re-enabling semantic-release.

---

If you want this documentation expanded into a `DEVELOPING.md` file or want me to add the diagnostic Action, tell me which and I'll add it in a PR.

## License

MIT © agiplv
