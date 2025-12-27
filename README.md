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

### E2E (fake gateway) tests

We include a simple fake Shelly BLU gateway and an E2E runner to validate discovery and polling locally:

- Start the fake gateway + headless Homebridge locally: `npm run e2e` (the script builds the project and runs the fake gateway + Homebridge, it times out after ~60s if discovery/polling isn't observed).
- The repository also includes a GitHub Actions workflow `.github/workflows/e2e.yml` that runs the same test in CI.

### Coverage check

To ensure coverage is sufficient:

- Run tests with coverage: `npm test`
- Check coverage threshold (lines): `npm run check-coverage` (configured to require at least 80% lines by default, set `COVERAGE_THRESHOLD` env to override)


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
