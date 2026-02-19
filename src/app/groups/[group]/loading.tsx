import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function GroupDetailLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-40 mb-2" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <div className="space-y-1">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-40" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Fund Name</TableHead>
            <TableHead className="text-right">Portfolio Value</TableHead>
            <TableHead className="text-right">Holdings</TableHead>
            <TableHead className="text-center">New</TableHead>
            <TableHead className="text-center">Exit</TableHead>
            <TableHead className="text-center">Add</TableHead>
            <TableHead className="text-center">Trim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-5 w-40" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
              <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
              <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
              <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
              <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
