"use client"

import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight } from "lucide-react"

export function CTA() {
  const reduce = useReducedMotion()

  return (
    <section className="py-24 lg:py-32 bg-muted/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl bg-foreground overflow-hidden"
        >
          {/* Bottom padding is what the handsets occupy: they are absolutely placed, so
              the copy has to reserve the room or the buttons sit on top of them. */}
          <div className="relative z-10 flex flex-col items-center text-center gap-8 px-8 pt-20 lg:pt-28 pb-[200px] sm:pb-[250px] lg:pb-[300px]">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Ready to Partner?</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-background font-mono text-balance max-w-3xl">
              Let&apos;s grow your business together
            </h2>
            <p className="text-lg text-background/70 max-w-xl leading-relaxed">
              Whether you need 10 units or 10,000, we have the stock, the prices, and the service to keep your business moving.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="#quote"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-10 py-4 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Get a Quote Today
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-background/20 px-10 py-4 text-sm font-semibold text-background hover:bg-background/10 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>

          {/* The source frame cuts the handsets off at its bottom edge, so they are hung
              off the bottom of the panel to land the composition they were shot for.
              Decorative: the section's meaning is carried by the heading. */}
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, delay: reduce ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-[290px] sm:w-[360px] lg:w-[430px]"
          >
            <Image
              src="/images/cta-lineup-1000.webp"
              alt=""
              width={936}
              height={582}
              sizes="(max-width: 640px) 290px, (max-width: 1024px) 360px, 430px"
              className="h-auto w-full"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
