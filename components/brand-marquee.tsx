const BRANDS = ["Apple", "Samsung", "Google", "Lenovo", "Xiaomi", "Sony", "Motorola", "Huawei", "Asus", "OnePlus"]

export function BrandMarquee() {
  // Rendered twice so the -50% keyframe loops seamlessly.
  const track = [...BRANDS, ...BRANDS]

  return (
    <section aria-label="Brands we supply" className="border-y border-border py-10 overflow-hidden">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-8">
        Brands we supply
      </p>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-background to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-background to-transparent"
        />
        <div className="flex w-max animate-[marquee_42s_linear_infinite] hover:[animation-play-state:paused]">
          {track.map((brand, i) => (
            <span
              key={`${brand}-${i}`}
              className="shrink-0 px-9 text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground/45 font-mono"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
