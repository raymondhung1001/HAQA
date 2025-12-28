import * as React from "react"
import { cn } from "@/lib/utils"

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Container size variant
   * - sm: max-width 640px (sm breakpoint)
   * - md: max-width 768px (md breakpoint)
   * - lg: max-width 1024px (lg breakpoint)
   * - xl: max-width 1280px (xl breakpoint)
   * - 2xl: max-width 1536px (2xl breakpoint)
   * - full: no max-width, full width
   * - default: max-width 1280px (xl)
   */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
  /**
   * Whether the container is fluid (no max-width)
   * @deprecated Use size="full" instead
   */
  fluid?: boolean
}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "xl", fluid, ...props }, ref) => {
    const sizeClasses = {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
      xl: "max-w-screen-xl",
      "2xl": "max-w-screen-2xl",
      full: "max-w-full",
    }

    const maxWidthClass = fluid ? sizeClasses.full : sizeClasses[size]

    return (
      <div
        ref={ref}
        className={cn(
          "w-full mx-auto px-4 sm:px-6 lg:px-8",
          maxWidthClass,
          className
        )}
        {...props}
      />
    )
  }
)
Container.displayName = "Container"

export { Container }
export type { ContainerProps }

