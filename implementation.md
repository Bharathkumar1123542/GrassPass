# Grass Pass Implementation Notes

This repository contains a minimal but valid MV3 extension shell for Grass Pass with the required project layout, constants, core logic, and test scaffolding described in the project specification.

## Structure

- `entrypoints/` contains the background worker and extension pages.
- `src/` contains the application logic and model abstractions.
- `tests/` contains unit and integration tests.

## Status

The implementation is intentionally compact and conservative: it keeps the extension logic typed, deterministic, and testable without depending on remote services.
