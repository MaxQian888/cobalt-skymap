"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner className="rounded-[inherit] bg-[var(--scrollbar-track)]" />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-0.5 transition-[background-color,opacity,box-shadow] duration-200 select-none opacity-75 hover:opacity-100",
        orientation === "vertical" &&
          "h-full w-3 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-3 flex-col border-t border-t-transparent",
        "rounded-full bg-[var(--scrollbar-track)] shadow-[inset_0_0_0_1px_var(--scrollbar-track-border)] hover:bg-[var(--scrollbar-track-hover)]",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative flex-1 rounded-full border border-transparent",
          "bg-[var(--scrollbar-thumb)] shadow-[var(--scrollbar-thumb-shadow)]",
          "before:absolute before:inset-x-0.5 before:top-0.5 before:h-1/3 before:rounded-full before:bg-white/20 before:content-['']",
          "transition-[background-color,transform] duration-200",
          "hover:bg-[var(--scrollbar-thumb-hover)] active:bg-[var(--scrollbar-thumb-active)] active:scale-[0.98]"
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
