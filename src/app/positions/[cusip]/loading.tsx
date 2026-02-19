import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function PositionDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-14" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Security header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-32 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fund holders table */}
      <div>
        <Skeleton className="h-6 w-28 mb-3" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Fund Name</TableHead>
              <TableHead>Strategy Group</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-center">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-14 mx-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
