export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-6 lg:pl-[264px] lg:pr-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton h-6 w-48" />
      <div className="skeleton mt-2 h-4 w-80" />
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <div className="skeleton h-44 lg:col-span-5" />
        <div className="skeleton h-44 lg:col-span-7" />
      </div>
      <div className="skeleton mt-4 h-80" />
    </div>
  )
}
