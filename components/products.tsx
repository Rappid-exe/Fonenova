import Image from "next/image"

const categories = [
  {
    title: "Smartphones",
    description: "Apple, Samsung, Google, and more.",
    image: "/images/hero-phones.png",
  },
  {
    title: "Tablets",
    description: "iPads, Galaxy Tabs, and other devices.",
    image: "/images/tablets.jpg",
  },
  {
    title: "Laptops",
    description: "MacBooks, ThinkPads, and more.",
    image: "/images/laptops.jpg",
  },
  {
    title: "Accessories",
    description: "Chargers, cases, earbuds, and cables.",
    image: "/images/accessories.jpg",
  },
]

export function Products() {
  return (
    <section id="products" className="py-20 lg:py-28 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-3 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            What we supply
          </h2>
          <p className="text-muted-foreground text-lg">
            New and graded stock across all major brands.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div
              key={category.title}
              className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)]"
            >
              <div className="relative h-48 w-full bg-muted overflow-hidden">
                <Image
                  src={category.image}
                  alt={category.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex flex-col gap-1 p-5">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{category.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{category.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
