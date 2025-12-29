
# Changelog

## [1.3.0] - 2025-12-29
### Added
- **Auto-Discovery**: Automatically discover Shelly BLU Gateways on the local network using mDNS
- Merge auto-discovered gateways with manual configuration (no duplicates)
- New `enableAutoDiscovery` config option (default: `true`)
- Comprehensive discovery tests with 97.8% code coverage

### Changed
- Configuration schema updated to make `gateways` array optional when auto-discovery is enabled
- Updated documentation with auto-discovery examples and mixed-mode configuration

## [Unreleased]
### Changed
- **Breaking:** Removed all automatic device discovery. You must now manually configure each gateway and TRV device in the Homebridge config.
- Updated config schema: `devices` array is now required for each gateway.
- Updated tests and documentation to match manual-only configuration.

### Fixed
- Improved error handling for manual device configuration.

## v1.0.8
### Changed
- Add manual `devices` configuration to `config.schema.json` and use it when discovery fails or returns zero devices.
- Add unit tests for manual device fallback and improve RPC/HTTP diagnostics.
- Improve RPC calling robustness (try `?id=` then `&id=` variants, and POST fallback).

### Fixed
- Handle gateways that return 404 for `/status` by allowing manual device configuration.

## [Earlier versions]
- Initial project scaffolding and CI
