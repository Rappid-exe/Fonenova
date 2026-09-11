"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const CATEGORIES = [
  {
    title: "Smartphones",
    description: "Apple, Samsung, Google and more. New and graded stock across every current generation.",
    image: "/images/camera-macro-960.jpg",
    span: "sm:col-span-2 sm:row-span-2",
    height: "min-h-[280px] sm:min-h-[420px]",
    dark: true,
  },
  {
    title: "Tablets",
    description: "iPads, Galaxy Tabs and more.",
    image: "/images/tablets.jpg",
    span: "",
    height: "min-h-[240px]",
  },
  {
    title: "Laptops",
    description: "MacBooks, ThinkPads and more.",
    image: "/images/laptops.jpg",
    span: "",
    height: "min-h-[240px]",
  },
  {
    title: "Accessories",
    description: "Chargers, cases, earbuds and cables, by the pallet.",
    image: "/images/accessories.jpg",
    span: "sm:col-span-2",
    height: "min-h-[240px]",
  },
]

export function Products() {
  const reduce = useReducedMotion()

  return (
    <section id="products" className="py-24 lg:py-32 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 mb-12"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">What we supply</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance max-w-xl">
            Four categories. One supplier.
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg">
            New and graded stock across all major brands, with minimum order quantities confirmed at quotation.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : 0.09 } } }}
          className="grid sm:grid-cols-4 gap-4 auto-rows-auto"
        >
          {CATEGORIES.map((cat) => (
            <motion.div
              key={cat.title}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 28 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
              }}
              className={`group relative overflow-hidden rounded-2xl border border-border ${cat.span} ${cat.height}`}
            >
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10"
              />
              <Link
                href="#quote"
                aria-label={`Request a quote for ${cat.title}`}
                className="absolute top-5 right-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white backdrop-blur transition-all hover:bg-white/25 group-hover:scale-105"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col gap-1.5">
                <h3 className="text-xl sm:text-2xl font-bold text-white font-mono">{cat.title}</h3>
                <p className="text-sm text-white/75 leading-relaxed max-w-sm">{cat.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
