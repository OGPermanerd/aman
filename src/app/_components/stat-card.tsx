import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  className?: string
}

export function StatCard({ label, value, subtitle, className }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
