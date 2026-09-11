"use client"

import Link from "next/link"
import { useRef } from "react"
import { Mail, FileText, Truck, ArrowRight } from "lucide-react"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"

const STEPS = [
  {
    number: "01",
    icon: Mail,
    title: "Get in touch",
    description: "Send us your list. Models, quantities, grades, and any specific requirements.",
  },
  {
    number: "02",
    icon: FileText,
    title: "Receive your quote",
    description: "We come back with pricing, availability and estimated delivery, usually within hours.",
  },
  {
    number: "03",
    icon: Truck,
    title: "Stock delivered",
    description: "Confirm the order and we dispatch within 24 hours. Tracked, insured, to your door.",
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 65%", "end 60%"],
  })
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section id="how-it-works" className="py-24 lg:py-32 border-t border-border">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto mb-16"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">How it works</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
            Three steps to stock your shelves
          </h2>
        </motion.div>

        <div ref={ref} className="relative">
          {/* progress rail, fills as you scroll the steps */}
          <div aria-hidden className="absolute left-[27px] top-4 bottom-4 w-px bg-border hidden sm:block">
            <motion.div
              style={{ scaleY: reduce ? 1 : railScale }}
              className="absolute inset-0 origin-top bg-primary"
            />
          </div>

          <div className="flex flex-col gap-10 sm:gap-14">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: reduce ? 0 : 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex gap-6 sm:gap-8 items-start"
              >
                <div className="relative z-10 shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl bg-card border border-border">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex flex-col gap-2 pt-1.5">
                  <span className="text-xs font-bold font-mono text-primary tracking-wider">{step.number}</span>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed max-w-lg">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-16">
          <Link
            href="#quote"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-9 py-4 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Start your order
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
