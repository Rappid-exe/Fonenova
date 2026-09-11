"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef } from "react"
import { ArrowRight } from "lucide-react"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  // Drives the scale/drift as the hero leaves the viewport.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const deviceScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.62])
  const deviceY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, reduce ? 1 : 0])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60])

  return (
    <section ref={ref} className="relative min-h-[100svh] flex items-center pt-28 pb-16 overflow-hidden">
      {/* soft ambient wash behind the devices */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 55% at 62% 42%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
          <motion.div style={{ opacity: copyOpacity, y: copyY }} className="flex flex-col gap-6">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Latest generation in stock now
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(2.75rem,7vw,5.25rem)] font-bold tracking-[-0.03em] leading-[0.95] text-balance"
            >
              Wholesale tech,
              <br />
              <span className="text-primary">delivered.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-lg text-lg text-muted-foreground leading-relaxed"
            >
              Bulk smartphones, tablets, laptops and accessories at genuine wholesale prices. Built for retailers and
              resellers who need stock that moves.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-3 pt-2"
            >
              <Link
                href="#quote"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Request Pricing
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#products"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-7 py-3.5 text-sm font-semibold hover:bg-secondary transition-colors"
              >
                View Products
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            style={{ scale: deviceScale, y: deviceY }}
            className="relative flex items-center justify-center lg:justify-end origin-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: -3 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-[58%] max-w-[300px] drop-shadow-2xl"
            >
              <Image
                src="/images/device-burgundy-900.webp"
                alt="Latest generation iPhone in burgundy, front and back"
                width={900}
                height={1088}
                priority
                sizes="(max-width: 1024px) 45vw, 300px"
                className="h-auto w-full"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40, rotate: 5 }}
              animate={{ opacity: 1, y: 0, rotate: 5 }}
              transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative -ml-[14%] w-[58%] max-w-[300px] drop-shadow-2xl"
            >
              <Image
                src="/images/device-black-900.webp"
                alt="Latest generation iPhone in black, front and back"
                width={900}
                height={1088}
                priority
                sizes="(max-width: 1024px) 45vw, 300px"
                className="h-auto w-full"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
