'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Sheet({
  open,
  onOpenChange,
  side = 'right',
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: 'right' | 'left'
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#0b1220]/30" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-full flex-col bg-canvas shadow-[0_0_40px_rgba(16,24,40,0.2)] outline-none',
            side === 'right' ? 'right-0 border-l border-line' : 'left-0 border-r border-line',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-[13px] text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Details</Dialog.Description>}
            </div>
            <Dialog.Close className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-black/[0.05] hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
