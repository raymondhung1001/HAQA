import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

export function ActionButton({ icon, label, description, onClick }: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start gap-4 p-4 text-left",
        "bg-muted/50 hover:bg-muted transition-colors group"
      )}
      onClick={onClick}
    >
      <div className="p-2 rounded-lg bg-background group-hover:text-primary transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Button>
  )
}
