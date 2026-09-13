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

## Tablets and Laptops cards

Supplied by the owner as URLs rather than files; licensing sits with the owner
as it does for the device photography below.

| File | Source |
| --- | --- |
| `tablets-ipad-800.webp` | `store.storeimages.cdn-apple.com` iPad compare card |
| `laptops-macbook-800.webp` | `macworld.com` MacBook Air 15in |

Both were auto-cropped to the bounding box of the devices before resizing. The
iPad source is 960x1000 with the devices in a band across the middle, so
uncropped it left most of the card empty white above and below the products.

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

`public/icon.svg`, `icon-light-32x32.png`, `icon-dark-32x32.png` and
`apple-icon.png` are generated from that same geometry, scaled 1.15x about the
centre so the handset fills the icon canvas rather than floating in it.

`logo.png` / `logo.jpg` are the owner's original supplied artwork, kept as the
source of record. They are not referenced by the site. The derived
`logo-light.png` / `logo-dark.png` were removed when the lockup went inline.
