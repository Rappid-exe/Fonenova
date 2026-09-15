"use client"

import { Receipt, ShieldCheck, FileCheck } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { COMPANY } from "@/lib/site"

/**
 * Sits between How It Works and the quote form: the point at which a buyer is working
 * out their own numbers and needs to know whether they can reclaim input VAT.
 *
 * Wording follows what the invoices actually say, including the Article 313 citation,
 * so the page and the paperwork cannot drift apart. It describes how FoneNova invoices
 * and is not offered as tax advice.
 */

const POINTS = [
  {
    icon: Receipt,
    title: "No VAT line on your invoice",
    body: "VAT is accounted for on our margin, not on the sale price. Nothing is shown separately and nothing is reclaimable.",
  },
  {
    icon: ShieldCheck,
    title: "The quote is the price",
    body: "No VAT is added at invoice. The figure we quote you is the figure you pay, so your landed cost is fixed from the start.",
  },
  {
    icon: FileCheck,
    title: "Stated on every quotation",
    body: "The treatment of each line is confirmed in writing before you commit, alongside the grade and the quantity.",
  },
]

export function VatScheme() {
  const reduce = useReducedMotion()

  return (
    <section id="vat" className="py-24 lg:py-32 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4 max-w-2xl"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Pricing and VAT</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance font-mono">
            Sold under the VAT margin scheme
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We deal exclusively in used and graded stock, sold under the VAT margin scheme for second-hand goods
            (Article 313 of Council Directive 2006/112/EC). It changes how your invoice looks, so it is worth knowing
            before you price a deal.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : 0.08 } } }}
          className="grid sm:grid-cols-3 gap-5 mt-12"
        >
          {POINTS.map((point) => (
            <motion.div
              key={point.title}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-7"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20">
                <point.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-mono">{point.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{point.body}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.15 }}
          className="mt-10 flex flex-col gap-4 rounded-2xl border border-border bg-card px-7 py-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <dl className="flex flex-col gap-3 sm:flex-row sm:gap-10">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Registered in Northern Ireland
              </dt>
              <dd className="text-sm font-mono font-bold text-foreground">{COMPANY.registrationNumber}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">VAT registration</dt>
              <dd className="text-sm font-mono font-bold text-foreground">{COMPANY.vatNumber}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground leading-relaxed sm:max-w-xs">
            This describes how we invoice. It is not tax advice &mdash; confirm your own position with your accountant.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
