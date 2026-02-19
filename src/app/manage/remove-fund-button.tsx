'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { removeFund } from './actions'

interface RemoveFundButtonProps {
  cik: string
  name: string
  strategyGroup: string
}

export function RemoveFundButton({ cik, name, strategyGroup }: RemoveFundButtonProps) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
      disabled={pending}
      onClick={() => {
        if (confirm(`Remove ${name} (CIK ${cik}) from ${strategyGroup}? Existing data will be kept.`)) {
          startTransition(async () => { await removeFund(cik, strategyGroup) })
        }
      }}
    >
      {pending ? '...' : 'Remove'}
    </Button>
  )
}
