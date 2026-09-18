# Social banners

One design, cut to five platform sizes. Like the rest of `brand/`, these live
outside `public/` and are not served by the site.

| File | Where it goes | Target | Actual |
| --- | --- | --- | --- |
| `fonenova-linkedin-cover-1128x191@2x.png` | LinkedIn **company page** cover | 1128x191 | 2256x382 |
| `fonenova-x-header-1500x500@2x.png` | X / Twitter header | 1500x500 | 3000x1000 |
| `fonenova-linkedin-personal-1584x396@2x.png` | LinkedIn personal profile background | 1584x396 | 3168x792 |
| `fonenova-facebook-cover-1640x624@2x.png` | Facebook page cover | 1640x624 | 3280x1248 |
| `fonenova-share-card-1200x630@2x.png` | Link previews, WhatsApp, general posts | 1200x630 | 2400x1260 |

Everything is rendered at 2x so it stays sharp on a retina display, which is
where most of these are actually seen. Aspect ratios are exact, so no platform
crops them on upload — only the pixel count is doubled.

The profile picture that sits alongside these is the existing icon tile:
`public/icon-128.png` for most uses, `public/apple-icon.png` where something
larger is wanted.

## Drawn from the real assets, not traced

Nothing here was redrawn by eye. If the brand changes, these are regenerated
from the same sources rather than edited:

- **The tile** is `public/icon.svg` verbatim — the same rounded-rect handset
  knocked out of a brand-blue tile with the spark punched back through.
- **The wordmark** is the same Archivo outlines the site renders, from
  `components/logo-paths.ts`: `FONE_PATH` in `#ffffff`, `NOVA_PATH` in
  `#0099f2`, `SUBLINE_PATH` in white at 50% opacity, positioned by that file's
  own `FULL` box and `subDx` offset. Not a font lookup, so it cannot drift from
  the site lockup.
- **The type** is Inter and Space Grotesk, the two faces `app/layout.tsx`
  already loads. The tagline is Space Grotesk 500, matching the site's headings;
  the detail row is Inter.

## Colours

| Role | Value |
| --- | --- |
| Tile, brand blue | `#0076d2` (`--primary`, light) |
| NOVA, accent dots | `#0099f2` (`--primary`, dark) |
| Field | `#0e141c` → `#090b0f` → `#0b1219`, 135° |
| Glow | `#0099f2` at 30%, radial from the top right |

The field is dark rather than solid brand blue on purpose. A blue field would
have forced either a blue tile on blue, or dropping the icon; dark lets the tile
carry the colour and reads better for trade buyers.

## Safe zones — read this before redesigning

Every one of these platforms drops something on top of the banner, always at the
bottom-left:

- **X** overlaps the header with the avatar, roughly a 200px circle inset from
  the left edge and hanging off the bottom.
- **LinkedIn personal** overlaps the background with the profile photo in the
  same corner.
- **LinkedIn company** puts the page logo over the bottom-left of the cover, so
  the lockup here starts at x=196 rather than at the margin.
- **Facebook** crops the cover inward on mobile, showing roughly the central 78%
  of the width, so nothing sits near the left or right edge.

Content in every size is held clear of those regions. This is the detail that
gets lost first: a banner looks correct in the upload preview and then the
company's own logo lands on top of a word.

## Regenerating

The generator is **not** committed. It reads `components/logo-paths.ts`,
`public/icon.svg` and the Inter / Space Grotesk `.woff2` files that `next build`
writes to `.next/static/media`, builds one HTML file per size, and screenshots
each in headless Chromium at 2x device scale. Ask and it can be added here so
the set is reproducible without rebuilding it from scratch.
