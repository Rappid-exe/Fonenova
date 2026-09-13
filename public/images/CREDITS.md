# Image credits and licensing

## Category photography (Unsplash License)

Free for commercial use, no attribution required. Source IDs kept here so the
originals can be re-downloaded at higher resolution if needed.

| File | Unsplash photo ID |
| --- | --- |
| `accessories-1200.jpg` | `photo-1578319439584-104c94d37305` |

Re-download with `https://images.unsplash.com/<id>?w=1600&q=80&fm=jpg`.

`tablets-1200.jpg` and `laptops-1200.jpg` were the Unsplash shots for those two
cards. They are no longer referenced, having been replaced at the owner's
direction by the files below.

## Tablets, Laptops and Accessories cards

Supplied by the owner as URLs rather than files; licensing sits with the owner
as it does for the device photography below.

| File | Source |
| --- | --- |
| `tablets-ipad-800.webp` | `store.storeimages.cdn-apple.com` iPad compare card |
| `laptops-macbook-800.webp` | `macworld.com` MacBook Air 15in |
| `accessories-cases-900.webp` | `s.yimg.com` cases, MagSafe and crossbody straps |

Both were auto-cropped to the bounding box of the devices before resizing. The
iPad source is 960x1000 with the devices in a band across the middle, so
uncropped it left most of the card empty white above and below the products.

Both also carry a bottom-weighted darkening baked into the file. Their grounds
are light where the other two cards' shots are dark, and measured against the
white caption text they came out at 4.36:1 and 3.64:1, under the 4.5:1 AA
threshold that 14px body text has to meet. The card's own gradient is shared by
all four cards and could not be strengthened for these two alone. The ramp
reaches full strength at 78% of image height rather than 100%, because
`object-cover` crops these cards to a middle band and a ramp peaking at the
file's bottom edge never peaks inside the visible area.

## Device photography

`device-burgundy-*.webp`, `device-black-*.webp`, `lineup-dark-*.jpg` and
`camera-macro-960.jpg` were supplied by the site owner from third-party
sources. They are used as supplied; licensing for these sits with the owner.
The lineup section carries an "images are for illustration" note because some
of these are press or concept renders rather than photographs of stock held.

`lineup4-*.webp` is the four-colourway group keyed from an owner-supplied
source. The backdrop was removed by flood-filling inward from the frame edge
rather than by colour distance: a distance key punched holes through the white
handset, whose body sits within tolerance of the light background.

## Logo

The brand lockup is drawn inline in `components/logo.tsx`, not shipped as a
bitmap. The mark is a rounded-rect handset (`rect x=26 y=10 w=48 h=80 rx=13`
on a 100x100 viewBox) holding a four-point nova spark. Both fills read from
`var(--primary)` and `var(--background)`, so the mark follows the theme and
needs no second dark-mode asset.

The wordmark is **Archivo** (SIL Open Font License 1.1, Omnibus-Type), cut to
outlines in `components/logo-paths.ts` rather than loaded as a webfont. Eight
characters and a subline do not justify a ~69KB typeface and an extra request;
the outlines are 3.9KB gzipped, inline, and cannot reflow or shift if a font
request is slow or fails. Keeping them as paths rather than an external SVG
also preserves `currentColor` and `var(--primary)`, which an `<img>` could not
inherit.

Path data is generated at 1000 units/em with baseline at y=0, from Archivo 700
for the wordmark and 500 for the subline, carrying the same -0.025em and
0.34em tracking the CSS version used. Do not hand-edit it.

`public/icon.svg`, `icon-light-32x32.png`, `icon-dark-32x32.png` and
`apple-icon.png` are generated from that same geometry, scaled 1.15x about the
centre so the handset fills the icon canvas rather than floating in it.

`logo.png` / `logo.jpg` are the owner's original supplied artwork, kept as the
source of record. They are not referenced by the site. The derived
`logo-light.png` / `logo-dark.png` were removed when the lockup went inline.

## CTA lineup

`cta-lineup-1000.webp` is Apple's homepage carriers promo shot, supplied by the
owner as a URL. Taken from the `_large_2x` variant (2524x1160) rather than
`_large`, which keys down to only 468px of usable handset.

The grey ground was removed by flood-filling inward from the frame edge, seeded
from the top and sides ONLY. The handsets bleed off the bottom edge of the
frame, so seeding the bottom too lets the fill walk up inside the white and
light-blue bodies, whose colour sits within tolerance of the ground, and hollow
them out. That failure is invisible against a light background and obvious
against the CTA panel, which is near-black in light mode.

The panel inverts with the theme, so the keyed handsets have to hold on both a
near-black and a near-white ground. They do: a light grey ground is the shot's
native context, and the dark camera modules and edge highlights carry it
against black.

`accessories-cases-900.webp` needed no darkening: its products are darker and
denser than the iPad and MacBook shots, and it measures 5.41:1 against the
caption as supplied.
