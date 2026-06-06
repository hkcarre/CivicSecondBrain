# Changelog

## [1.13.0](https://github.com/xozai/CivicSecondBrain/compare/v1.12.0...v1.13.0) (2026-06-06)


### Features

* admin panel authentication via ADMIN_PASSWORD + signed session cookie ([#109](https://github.com/xozai/CivicSecondBrain/issues/109)) ([c0b32bc](https://github.com/xozai/CivicSecondBrain/commit/c0b32bcf7edf64ae15659bbcb0725747e2c6bc0a))

## [1.12.0](https://github.com/xozai/CivicSecondBrain/compare/v1.11.4...v1.12.0) (2026-06-06)


### Features

* add DOCX and XLSX parsing with mammoth and SheetJS ([#73](https://github.com/xozai/CivicSecondBrain/issues/73)) ([6fe36ae](https://github.com/xozai/CivicSecondBrain/commit/6fe36ae7f333bb0145b80e1efdd6cfcf6615a7c2))

## [1.11.4](https://github.com/xozai/CivicSecondBrain/compare/v1.11.3...v1.11.4) (2026-06-06)


### Bug Fixes

* race condition — save manifest once after loop not per-document ([#76](https://github.com/xozai/CivicSecondBrain/issues/76)) ([b6c00f1](https://github.com/xozai/CivicSecondBrain/commit/b6c00f16c491a353a0ac1ddd11d2a0906dba8775))

## [1.11.3](https://github.com/xozai/CivicSecondBrain/compare/v1.11.2...v1.11.3) (2026-06-06)


### Bug Fixes

* **ingest:** move checksum dedup after download so localPath is available ([#75](https://github.com/xozai/CivicSecondBrain/issues/75)) ([e1b3896](https://github.com/xozai/CivicSecondBrain/commit/e1b38969e545e60ecbe76e8cdf3c7dd6eb91e17a))

## [1.11.2](https://github.com/xozai/CivicSecondBrain/compare/v1.11.1...v1.11.2) (2026-06-06)


### Bug Fixes

* populate assistant bubble with error text when stream body is null ([#77](https://github.com/xozai/CivicSecondBrain/issues/77)) ([f803a8e](https://github.com/xozai/CivicSecondBrain/commit/f803a8e8ffb4e2cdd82a3754ccb56ff61ba549bf))

## [1.11.1](https://github.com/xozai/CivicSecondBrain/compare/v1.11.0...v1.11.1) (2026-06-05)


### Bug Fixes

* **deploy:** move tsx to dependencies, fix duplicate header JSX ([#102](https://github.com/xozai/CivicSecondBrain/issues/102)) ([a19d324](https://github.com/xozai/CivicSecondBrain/commit/a19d3246c38524d5845cd6e135f7385272ba5ef8))

## [1.11.0](https://github.com/xozai/CivicSecondBrain/compare/v1.10.1...v1.11.0) (2026-06-05)


### Features

* persist chat history to localStorage across page refreshes ([#79](https://github.com/xozai/CivicSecondBrain/issues/79)) ([d63ab9f](https://github.com/xozai/CivicSecondBrain/commit/d63ab9f699059da9ba6c17e4a83464b723c5c48c))

## [1.10.1](https://github.com/xozai/CivicSecondBrain/compare/v1.10.0...v1.10.1) (2026-06-05)


### Bug Fixes

* **lint:** dedup recommendation pages by slug instead of always creating dated files ([#95](https://github.com/xozai/CivicSecondBrain/issues/95)) ([43ae48f](https://github.com/xozai/CivicSecondBrain/commit/43ae48f00c7b938c3f4615fa059eda8fb3a3b786))

## [1.10.0](https://github.com/xozai/CivicSecondBrain/compare/v1.9.0...v1.10.0) (2026-06-05)


### Features

* add dark mode support with Tailwind class strategy ([#96](https://github.com/xozai/CivicSecondBrain/issues/96)) ([a744ce9](https://github.com/xozai/CivicSecondBrain/commit/a744ce9a9e339152ca33daf56b04cbb401f97301))

## [1.9.0](https://github.com/xozai/CivicSecondBrain/compare/v1.8.3...v1.9.0) (2026-06-05)


### Features

* add full-text wiki search API endpoint ([#80](https://github.com/xozai/CivicSecondBrain/issues/80)) ([e103b9b](https://github.com/xozai/CivicSecondBrain/commit/e103b9b097d39f51130f2f89a44d1e0a63c3bbd3))

## [1.8.3](https://github.com/xozai/CivicSecondBrain/compare/v1.8.2...v1.8.3) (2026-06-05)


### Performance Improvements

* **docker:** slim production image with npm ci --omit=dev ([#81](https://github.com/xozai/CivicSecondBrain/issues/81)) ([aa2f5a5](https://github.com/xozai/CivicSecondBrain/commit/aa2f5a585850aeecf257eb821b3dfa74e1904f42))

## [1.8.2](https://github.com/xozai/CivicSecondBrain/compare/v1.8.1...v1.8.2) (2026-06-05)


### Bug Fixes

* skip unsupported formats (docx/xlsx) without calling Claude ([#82](https://github.com/xozai/CivicSecondBrain/issues/82)) ([f259115](https://github.com/xozai/CivicSecondBrain/commit/f259115507c04c75453a85859491849d2df336c0))

## [1.8.1](https://github.com/xozai/CivicSecondBrain/compare/v1.8.0...v1.8.1) (2026-06-05)


### Bug Fixes

* **health:** add live Anthropic API probe to catch revoked keys ([#84](https://github.com/xozai/CivicSecondBrain/issues/84)) ([5435b91](https://github.com/xozai/CivicSecondBrain/commit/5435b916ead6d723b44606237c84867de2abb504))

## [1.8.0](https://github.com/xozai/CivicSecondBrain/compare/v1.7.2...v1.8.0) (2026-06-05)


### Features

* add dark mode support with Tailwind class strategy ([#85](https://github.com/xozai/CivicSecondBrain/issues/85)) ([d578c42](https://github.com/xozai/CivicSecondBrain/commit/d578c42414d81c719a950349a46e950d5df4919d))

## [1.7.2](https://github.com/xozai/CivicSecondBrain/compare/v1.7.1...v1.7.2) (2026-06-05)


### Performance Improvements

* enforce token budget in buildWikiContext, fix hard slice in LINT ([#86](https://github.com/xozai/CivicSecondBrain/issues/86)) ([fdcb371](https://github.com/xozai/CivicSecondBrain/commit/fdcb371f596b4f0494c70f3280aea31737000781))

## [1.7.1](https://github.com/xozai/CivicSecondBrain/compare/v1.7.0...v1.7.1) (2026-06-05)


### Bug Fixes

* **lint:** dedup recommendation pages by slug instead of always creating dated files ([#83](https://github.com/xozai/CivicSecondBrain/issues/83)) ([3555f4f](https://github.com/xozai/CivicSecondBrain/commit/3555f4f1769e0a8a829d33848eac9e4fa58da6e3))

## [1.7.0](https://github.com/xozai/CivicSecondBrain/compare/v1.6.0...v1.7.0) (2026-06-05)


### Features

* export recommendations as markdown/PDF-ready report ([#71](https://github.com/xozai/CivicSecondBrain/issues/71)) ([c3ba887](https://github.com/xozai/CivicSecondBrain/commit/c3ba887dde779243f9230301d9d047760811eed4))

## [1.6.0](https://github.com/xozai/CivicSecondBrain/compare/v1.5.4...v1.6.0) (2026-06-05)


### Features

* **ingest:** configurable max file size via MAX_FILE_SIZE_MB env var ([#66](https://github.com/xozai/CivicSecondBrain/issues/66)) ([c1e2862](https://github.com/xozai/CivicSecondBrain/commit/c1e2862a7a2597d6dae0e45dafae49cea573dc08))

## [1.5.4](https://github.com/xozai/CivicSecondBrain/compare/v1.5.3...v1.5.4) (2026-06-05)


### Performance Improvements

* **ingest:** parallelize discovery and ingest worker pool ([#63](https://github.com/xozai/CivicSecondBrain/issues/63)) ([c550185](https://github.com/xozai/CivicSecondBrain/commit/c55018598b7a2ca51d79cb94971e0407fd700b79))

## [1.5.3](https://github.com/xozai/CivicSecondBrain/compare/v1.5.2...v1.5.3) (2026-06-05)


### Bug Fixes

* **reader:** auto-repair unquoted YAML titles instead of crashing ([#38](https://github.com/xozai/CivicSecondBrain/issues/38)) ([318e2b2](https://github.com/xozai/CivicSecondBrain/commit/318e2b24ae7012689ea016b892ad58827d535165))

## [1.5.2](https://github.com/xozai/CivicSecondBrain/compare/v1.5.1...v1.5.2) (2026-06-05)


### Bug Fixes

* chat streaming UX, Laserfiche error visibility, wiki 404 UX ([#35](https://github.com/xozai/CivicSecondBrain/issues/35)) ([fb9d43f](https://github.com/xozai/CivicSecondBrain/commit/fb9d43f81023090a086fdb0c3a10801f3b5f87a1))

## [1.5.1](https://github.com/xozai/CivicSecondBrain/compare/v1.5.0...v1.5.1) (2026-06-05)


### Bug Fixes

* **chat:** add try/catch to chat route, enrich health endpoint ([#33](https://github.com/xozai/CivicSecondBrain/issues/33)) ([c3e5cba](https://github.com/xozai/CivicSecondBrain/commit/c3e5cba3326766dd9cf5a88cf04cfb36b677435b))

## [1.5.0](https://github.com/xozai/CivicSecondBrain/compare/v1.4.2...v1.5.0) (2026-06-05)


### Features

* **ingest:** change detection — only re-ingest modified documents ([#31](https://github.com/xozai/CivicSecondBrain/issues/31)) ([d49ed50](https://github.com/xozai/CivicSecondBrain/commit/d49ed50b7d7855a487eed5c3a365793acc17d956))

## [1.4.2](https://github.com/xozai/CivicSecondBrain/compare/v1.4.1...v1.4.2) (2026-06-05)


### Bug Fixes

* **ingest:** prevent disk full — HEAD check before download, delete after ingest ([#29](https://github.com/xozai/CivicSecondBrain/issues/29)) ([a92e59d](https://github.com/xozai/CivicSecondBrain/commit/a92e59d3faacbb0794954ad63d8540ee1f26ce35))

## [1.4.1](https://github.com/xozai/CivicSecondBrain/compare/v1.4.0...v1.4.1) (2026-06-05)


### Bug Fixes

* **ingest:** skip full scrape when --type, --limit, or --board flags are used ([#26](https://github.com/xozai/CivicSecondBrain/issues/26)) ([5f5c216](https://github.com/xozai/CivicSecondBrain/commit/5f5c216eb570136dbf8e2bf19d92ecf042e80229))

## [1.4.0](https://github.com/xozai/CivicSecondBrain/compare/v1.3.5...v1.4.0) (2026-06-05)


### Features

* MVP features — wiki detail page, file answer, multi-city config, run analysis button, manifest dedup ([#22](https://github.com/xozai/CivicSecondBrain/issues/22)) ([f877ab4](https://github.com/xozai/CivicSecondBrain/commit/f877ab4ce6880fb9067625ff10d7c3333d40d17c))

## [1.3.5](https://github.com/xozai/CivicSecondBrain/compare/v1.3.4...v1.3.5) (2026-06-05)


### Performance Improvements

* reduce memory usage in ingest and lint ([#23](https://github.com/xozai/CivicSecondBrain/issues/23)) ([7cf36b9](https://github.com/xozai/CivicSecondBrain/commit/7cf36b99b5e835aa7f3335b5f3c58c1ccdd7e75d))

## [1.3.4](https://github.com/xozai/CivicSecondBrain/compare/v1.3.3...v1.3.4) (2026-06-04)


### Bug Fixes

* **wiki:** quote title in YAML frontmatter to handle colons ([#19](https://github.com/xozai/CivicSecondBrain/issues/19)) ([b46d491](https://github.com/xozai/CivicSecondBrain/commit/b46d491b06e300fba4b6677ab2d24fa5eadace1a))

## [1.3.3](https://github.com/xozai/CivicSecondBrain/compare/v1.3.2...v1.3.3) (2026-06-04)


### Bug Fixes

* **deploy:** auto-initialize wiki volume on first boot ([#17](https://github.com/xozai/CivicSecondBrain/issues/17)) ([709688a](https://github.com/xozai/CivicSecondBrain/commit/709688a09666a642ac1ef7c91a4953e48e16146f))

## [1.3.2](https://github.com/xozai/CivicSecondBrain/compare/v1.3.1...v1.3.2) (2026-06-04)


### Bug Fixes

* **scripts:** add missing lint-wiki, scraper-check, and ingest-doc scripts ([#15](https://github.com/xozai/CivicSecondBrain/issues/15)) ([e63d36a](https://github.com/xozai/CivicSecondBrain/commit/e63d36a1f7529265e51e27a386636588237081fc))

## [1.3.1](https://github.com/xozai/CivicSecondBrain/compare/v1.3.0...v1.3.1) (2026-06-04)


### Bug Fixes

* **deploy:** finalize Dockerfile and Railway config ([#12](https://github.com/xozai/CivicSecondBrain/issues/12)) ([d0f4851](https://github.com/xozai/CivicSecondBrain/commit/d0f48512fbc87096db8e9e0d84e748d8d3bca195))

## [1.3.0](https://github.com/xozai/CivicSecondBrain/compare/v1.2.0...v1.3.0) (2026-06-04)


### Features

* **deploy:** add Dockerfile, Railway config, and health endpoint ([#10](https://github.com/xozai/CivicSecondBrain/issues/10)) ([6e7b3f1](https://github.com/xozai/CivicSecondBrain/commit/6e7b3f12d664ddb74dfe68ccc10d972bd8d41343))

## [1.2.0](https://github.com/xozai/CivicSecondBrain/compare/v1.1.0...v1.2.0) (2026-06-04)


### Features

* **scraper:** deep DocumentCenter crawl + wiki fixes + dashboard fix ([#6](https://github.com/xozai/CivicSecondBrain/issues/6)) ([e913d4f](https://github.com/xozai/CivicSecondBrain/commit/e913d4f7273db4e2cf4b6b9055318cc168f6d9ac))

## [1.1.0](https://github.com/xozai/CivicSecondBrain/compare/v1.0.0...v1.1.0) (2026-06-04)


### Features

* **scraper:** add Laserfiche WebLink scraper, wiki page, and test suite ([#4](https://github.com/xozai/CivicSecondBrain/issues/4)) ([2065377](https://github.com/xozai/CivicSecondBrain/commit/20653772bd738085563939152bff8954f7515650))

## 1.0.0 (2026-06-03)


### Features

* initial CivicSecondBrain scaffold — Schertz TX city council AI assistant ([29074c6](https://github.com/xozai/CivicSecondBrain/commit/29074c6fe0cb0c180c218b17f29fd3fe46a7dd98))

## Changelog

All notable changes to this project will be documented here.

This file is auto-generated by [release-please](https://github.com/googleapis/release-please).
Do not edit manually — your changes will be overwritten on the next release.
