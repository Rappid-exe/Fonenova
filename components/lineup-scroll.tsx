"use client"

import Image from "next/image"
import { useRef } from "react"
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "motion/react"

const PANELS = [
  {
    eyebrow: "Latest generation",
    title: "Flagship stock, the week it lands",
    body: "We source the newest releases at volume so you are not waiting months to put current-generation handsets on your shelves.",
  },
  {
    eyebrow: "Every colourway",
    title: "Full range, not just the leftovers",
    body: "Black, white, blue, burgundy. We hold the whole spread so you can match demand instead of taking whatever is left in the channel.",
  },
  {
    eyebrow: "Graded and checked",
    title: "You know exactly what you are buying",
    body: "Every unit is inspected and graded A, B or C before it ships. The grade is confirmed at quotation, so there are no surprises on arrival.",
  },
]

export function LineupScroll() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  })

  // Cross-fade the two colourways across the pinned scroll.
  const burgundyOpacity = useTransform(scrollYProgress, [0, 0.34, 0.62], [1, 1, 0])
  const blackOpacity = useTransform(scrollYProgress, [0.34, 0.62, 1], [0, 1, 1])
  const deviceRotate = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : -6, reduce ? 0 : 6])
  const deviceScale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.92, 1.04, 0.96])

  return (
    <section ref={ref} id="lineup" className="relative border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Pinned device column */}
          <div className="hidden lg:block">
            <div className="sticky top-0 h-screen flex items-center justify-center">
              <motion.div
                style={{ rotate: deviceRotate, scale: deviceScale }}
                className="relative w-full max-w-[330px] aspect-[900/1088]"
              >
                <motion.div style={{ opacity: burgundyOpacity }} className="absolute inset-0 drop-shadow-2xl">
                  <Image
                    src="/images/device-burgundy-900.webp"
                    alt="Latest generation iPhone in burgundy"
                    fill
                    sizes="330px"
                    className="object-contain"
                  />
                </motion.div>
                <motion.div style={{ opacity: blackOpacity }} className="absolute inset-0 drop-shadow-2xl">
                  <Image
                    src="/images/device-black-900.webp"
                    alt="Latest generation iPhone in black"
                    fill
                    sizes="330px"
                    className="object-contain"
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Scrolling copy column */}
          <div className="flex flex-col">
            {PANELS.map((panel, i) => (
              <Panel key={panel.title} panel={panel} index={i} progress={scrollYProgress} count={PANELS.length} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile device strip: no pinning, just the pair side by side */}
      <div className="lg:hidden px-6 pb-20">
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/images/device-burgundy-450.webp"
            alt="Latest generation iPhone in burgundy"
            width={450}
            height={543}
            sizes="40vw"
            className="w-[42%] h-auto drop-shadow-xl"
          />
          <Image
            src="/images/device-black-450.webp"
            alt="Latest generation iPhone in black"
            width={450}
            height={543}
            sizes="40vw"
            className="w-[42%] h-auto drop-shadow-xl"
          />
        </div>
      </div>
    </section>
  )
}

function Panel({
  panel,
  index,
  progress,
  count,
}: {
  panel: (typeof PANELS)[number]
  index: number
  progress: MotionValue<number>
  count: number
}) {
  const reduce = useReducedMotion()
  const start = index / count
  const end = (index + 1) / count

  // Each panel brightens as it owns the pinned device, dims as it hands over.
  // Offsets must stay inside [0, 1] and strictly increase: Motion maps them onto a
  // native scroll timeline, and out-of-range values make WAAPI reject the keyframes.
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  const stops = [clamp(start - 0.12), clamp(start + 0.06), clamp(end - 0.06), clamp(end + 0.12)]
  const input = stops.map((n, i) => (i === 0 ? n : Math.max(n, stops[i - 1] + 0.001)))

  const opacity = useTransform(progress, input, reduce ? [1, 1, 1, 1] : [0.35, 1, 1, 0.35])

  return (
    <motion.div
      style={{ opacity }}
      className="min-h-[60vh] lg:min-h-screen flex flex-col justify-center gap-4 py-16 lg:py-0"
    >
      <p className="text-sm font-semibold text-primary uppercase tracking-wider">{panel.eyebrow}</p>
      <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">{panel.title}</h3>
      <p className="text-lg text-muted-foreground leading-relaxed max-w-md">{panel.body}</p>
    </motion.div>
  )
}
