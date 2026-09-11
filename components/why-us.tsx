"use client"

import { ShieldCheck, Zap, BadgePoundSterling, Truck, PackageCheck, Handshake } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const FEATURES = [
  {
    icon: BadgePoundSterling,
    title: "Competitive Pricing",
    description: "Genuine wholesale rates with volume discounts. The more you order, the better the unit price.",
  },
  {
    icon: ShieldCheck,
    title: "Quality Guaranteed",
    description: "Every product is inspected and graded before dispatch. We stand behind what we sell.",
  },
  {
    icon: Zap,
    title: "Fast Turnaround",
    description: "Orders processed and dispatched within 24 hours. No waiting weeks for your stock.",
  },
  {
    icon: Truck,
    title: "UK-Wide Delivery",
    description: "Reliable, tracked and insured shipping across the UK. Next-day options available.",
  },
  {
    icon: PackageCheck,
    title: "Bulk & Custom Orders",
    description: "From 10 units to 10,000. We handle any size and can source specific models on request.",
  },
  {
    icon: Handshake,
    title: "Dedicated Support",
    description: "A real person you can email. Build a relationship with a supplier who knows your business.",
  },
]

export function WhyUs() {
  const reduce = useReducedMotion()

  return (
    <section id="why-us" className="py-24 lg:py-32 bg-secondary/40 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto mb-16"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Why Fonenova</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
            Built for serious resellers
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Reliable stock, fair prices, and a supplier you can actually get hold of.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : 0.07 } } }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-7 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 transition-transform duration-300 group-hover:scale-105">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-mono">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
