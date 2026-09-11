"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef } from "react"
import { ArrowRight } from "lucide-react"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"

const COLOURWAYS = ["Black", "White", "Blue", "Burgundy"]

export function DarkLineup() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  // Slow parallax drift + scale on the lineup shot as the band passes.
  const imageY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["4%", "-4%"])
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.94, 1, 0.94])

  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto mb-14"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">The current lineup</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
            Every finish. Every capacity. In volume.
          </h2>
          <p className="text-lg text-white/60 leading-relaxed">
            Tell us the split you need across colourways and storage tiers, and we will quote the whole order as one
            line.
          </p>
        </motion.div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 px-4 py-6 sm:px-10 sm:py-10">
          <motion.div style={{ y: imageY, scale: imageScale }} className="relative aspect-[4/3] sm:aspect-[16/10]">
            <Image
              src="/images/lineup-dark-2000.jpg"
              alt="Latest generation iPhone lineup in black, white, blue and burgundy"
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-contain"
            />
          </motion.div>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : 0.08 } } }}
          className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {COLOURWAYS.map((colour) => (
            <motion.li
              key={colour}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-medium text-white/80"
            >
              {colour}
            </motion.li>
          ))}
        </motion.ul>

        <div className="mt-12 flex flex-col items-center justify-center gap-4">
          <Link
            href="#quote"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Quote this lineup
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="text-xs text-white/40 text-center max-w-sm">
            Product images are for illustration. Exact models, grades and finishes are confirmed at quotation.
          </p>
        </div>
      </div>
    </section>
  )
}
