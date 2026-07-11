# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

TS-Suite ("STOBER Werkzeuge") is a collection of standalone, client-side-only HTML tools for the door/access-control trade (Tür & Zutrittskontrolle), covering dormakaba, record, Gilgen and GEZE hardware. There is no backend, build system, package manager, or test suite — every tool is a single self-contained `.html` file (inline `<style>` and `<script>`, often with base64-embedded images) that runs entirely in the browser. Static JSON files alongside the HTML act as the shared data layer.

| File | Purpose |
|---|---|
| `index.html` | Static landing/portal page linking to all tools (cards grid). No app logic. |
| `admin.html` | Admin UI for editing the three shared JSON data files (`ma-codes.json`, `artikel.json`, `hersteller-sichtbar.json`) and producing updated versions to commit. |
| `drehtuer-konfigurator.html` | Configurator for revolving/swing door drives (dormakaba, record, Gilgen, GEZE) — walks through model/mounting/options and resolves article numbers from `artikel.json`. |
| `schiebetuer-konfigurator.html` | Same idea as the above, for sliding door drives. |
| `aufmass-konfigurator.html` | Site-survey / measurement protocol tool ("Aufnahmeprotokoll") for door leaves; generates a PDF via `jsPDF` + `html2canvas` (loaded from cdnjs). |
| `zuko-planungstool.html` | Field-planning tool for access-control points (Zutrittskontrolle) for external/sales staff. |
| `zuko-bauteil-editor.html` | Editor for the shared access-control component/wiring library (`zuko-systeme-bibliothek.json`). |
| `zuko-kabelplan-generator.html` | Generates wiring plans ("Kabelplan") from the same component library that `zuko-bauteil-editor.html` edits. |
| `artikel.json` | Central article/SKU numbers, keyed by dotted paths like `drehtuer.dk.modell.ed100` (`dk`=dormakaba, `rc`=record, `gi`=Gilgen, `gz`=GEZE). Empty string = number not yet known. |
| `ma-codes.json` | Employee ("Mitarbeiter") ID → name map, used to gate/attribute tool usage. |
| `hersteller-sichtbar.json` | Per-manufacturer visibility toggle (`dk`/`gi`/`gz`/`rc` booleans) controlling which brands show up in the configurators. |
| `zuko-systeme-bibliothek.json` | Shared library of access-control systems/components/terminal (Klemme) wiring, used by both ZuKo tools. |

## Development workflow

There is no build, lint, or test tooling — this is plain HTML/CSS/JS meant to be opened directly or served as static files.

- **Run locally**: open any `.html` file directly in a browser, or serve the directory with a static file server (`python3 -m http.server`) so the `fetch()` calls to the sibling `.json` files work (some browsers restrict `fetch` on `file://` origins).
- **No package.json, no npm scripts, no CI.** Verify changes by opening the relevant tool in a browser and exercising its flow manually.
- Only two external runtime dependencies, loaded via CDN in `aufmass-konfigurator.html`: `html2canvas` and `jspdf` (both from cdnjs). Everything else is hand-rolled vanilla JS.
- `zuko-planungstool.html`, `drehtuer-konfigurator.html`, and `schiebetuer-konfigurator.html` call the public Nominatim (OpenStreetMap) reverse-geocoding API directly from the client for address lookup — no API key involved.

## Key conventions

- **Single-file-per-tool architecture is intentional.** Each tool duplicates its own `<style>` and shared "backbar" nav markup (class `stober-backbar`) rather than importing a common file — there is no shared CSS/JS module system. When changing shared look-and-feel (colors, nav), the same edit typically needs to be repeated across every `.html` file that has it (all of them except `index.html`).
- **JSON files are the source of truth, edited through `admin.html`, not by hand-authoring diffs of arbitrary shape.** `admin.html` fetches the live JSON, merges it with any local draft in `localStorage`, and on save calls `downloadJSON()` (`admin.html:435`) to produce a new file the user must download and replace in the repo — there is no server-side write path. When modifying these JSON files directly, keep keys alphabetically sorted the way `downloadJSON` does, since that's what a round-trip through `admin.html` produces.
- **Article-number keys in `artikel.json`** follow the dotted pattern `<produktgruppe>.<hersteller-kürzel>.<kategorie>.<wert>` (e.g. `drehtuer.dk.modell.ed100`). `hersteller-kürzel` is one of `dk` (dormakaba), `rc` (record), `gi` (Gilgen), `gz` (GEZE). The configurators self-check coverage of this map at load time (`pruefeArtikelAbdeckung()` in `drehtuer-konfigurator.html`/`schiebetuer-konfigurator.html`, exposed as `window.artikelAbdeckung()` for console debugging) and log which components are missing/malformed article numbers — keep new option keys consistent with this scheme so the coverage check stays meaningful.
- **`ma-codes.json` employee gate**: `drehtuer-konfigurator.html`, `schiebetuer-konfigurator.html`, and `aufmass-konfigurator.html` require entering a known employee code before use (`code-gate-*` elements). Codes are fetched from `ma-codes.json` with a hardcoded in-file fallback list (`MA_CODES_FALLBACK`) used if the fetch fails, and can be locally extended (never overridden) via `localStorage` key `stober_ma_codes_local` — comment in the code is explicit that local additions must never overwrite the central list. Usage is logged client-side only, to `localStorage` key `stober_ma_logs`.
- **Storage abstraction for shared/native environments**: `zuko-bauteil-editor.html` and `zuko-kabelplan-generator.html` both implement an identical `appStorage` wrapper that prefers `window.storage.get/set` (available when running inside the Claude.ai artifact/environment sandbox) and falls back to `localStorage` otherwise, using the same key (`'systeme-bibliothek'`) in both files so data is shared automatically when same-origin. Keep this wrapper (and its key) in sync between the two files if you touch it in one.
- **PayPal donation links** (`paypal.me/Marko436/...`) appear in `drehtuer-konfigurator.html`, `schiebetuer-konfigurator.html`, and `aufmass-konfigurator.html` as an author tip jar tied to a "paid" UI acknowledgement — this is intentional product behavior, not a bug or something to strip out.
- **Long base64-embedded image/icon lines**: several files (notably `index.html`, which is ~1MB despite only 360 lines) embed large base64 image data URIs on single very long lines. Before reading or editing these files, locate the long lines first (e.g. `awk '{print length, NR}' file.html | sort -rn | head`) and avoid loading them into context — page around them with `Read`'s `offset`/`limit` instead.
- **Language**: all UI text, comments, and data content are in German, matching the trade audience (Außendienst/Servicetechnik/Planung/Vertrieb in the door and access-control business).
