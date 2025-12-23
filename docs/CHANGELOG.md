# Changelog

### 23.11.2025 - 23.12.2025

- Implemented an automated GitHub Actions workflow for generating and updating the CHANGEL


All notable changes to this project will be documented in this file. See [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) for the standard format.

## [Unreleased] - 2025-11-18

### Added

- Seeded public-domain scores now persist `subtitle`/movement metadata in `songs.subtitle` so the UI and recommendation engine can surface richer descriptions. See [ADR-0001](./adr/0001-store-musicxml-metadata.md) for details.
 - The seeding pipeline now logs and stores the cleaned metadata (title/composer/subtitle) alongside the hashed MusicXML file for traceability (refer to [ADR-0001](./adr/0001-store-musicxml-metadata.md)).

### Changed

- The `songs.title` and `songs.composer` columns are now `NOT NULL`, enforcing the UI’s assumption that every song record contains those foundational metadata fields. See [ADR-0001](./adr/0001-store-musicxml-metadata.md).

