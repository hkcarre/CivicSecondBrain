# Changelog

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
