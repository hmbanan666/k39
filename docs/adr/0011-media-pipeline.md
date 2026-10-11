# ADR 0011: Place photo pipeline

## Status

Accepted.

ADR 0010 is the design system. This record is 0011 so that file stays put.

## Context

Place photos were stored as the original upload under `MEDIA_DIR`. The file kept EXIF, including GPS, and the page had one URL per file. Hubs and place heroes fell back to category SVG art.

## Decision

`sharp` is the only new dependency. On upload it rotates from EXIF, converts to sRGB, and drops metadata. The master is WebP quality 90 with the long side capped at 2560. Variants are AVIF quality 50 and WebP quality 78 at 320, 640, 960, 1280 and 1920, never wider than the master. `og.jpg` is a cover crop up to 1200×630. A 16px blurred WebP and the dominant color are stored for the LQIP.

Files live at `{MEDIA_DIR}/{mediaId}/`. `MediaStorage` is `put`, `get`, `delete`, and `exists`. The first implementation is the local disk. S3 can replace that object later. Old flat files still answer `/media/{filename}`.

Processing runs inside the upload request, two at a time. JPEG, PNG and WebP are accepted up to 25 MB. HEIC is rejected with a Russian message. A source narrower than 1200px is saved and the admin sees a warning.

`place_media` holds gallery order and the cover flag. Focal point is `focal_x` / `focal_y` in 0..1. `pnpm media:rebuild` regenerates variants from the master, or from the legacy flat file if the master is missing.

`<MediaImage>` renders a `<picture>` with AVIF and WebP srcset, width and height, the LQIP as background, and `object-position` from the focal point. Category SVG art remains the fallback when a place has no cover. The visible credit line uses the stored author, license and source URL.

Wikimedia Commons search is an admin action. The request sends a descriptive User-Agent. Only CC0, public domain, CC BY and CC BY-SA can be imported.

The site header background is opaque surface color. It stays sticky and keeps the bottom border.

## Consequences

The Docker image must contain the musl build of `sharp` next to the Nitro output, because `sharp` is external to the bundle. Run `pnpm media:rebuild` after changing quality or widths, and once for files uploaded before this pipeline.
