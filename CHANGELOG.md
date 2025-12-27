# Changelog

All notable changes to this project will be documented in this file.

## v1.0.8 - UNRELEASED

### Changed
- Add manual `devices` configuration to `config.schema.json` and use it when discovery fails or returns zero devices.
- Add unit tests for manual device fallback and improve RPC/HTTP diagnostics.
- Improve RPC calling robustness (try `?id=` then `&id=` variants, and POST fallback).

### Fixed
- Handle gateways that return 404 for `/status` by allowing manual device configuration.


## [Unreleased]
- Initial project scaffolding and CI
