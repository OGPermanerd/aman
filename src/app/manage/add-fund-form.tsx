'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addFund } from './actions'

interface AddFundFormProps {
  groups: string[]
}

function submitAction(_prev: { error?: string }, formData: FormData) {
  return addFund(formData)
}

export function AddFundForm({ groups }: AddFundFormProps) {
  const [state, action, pending] = useActionState(submitAction, {})

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cik">CIK Number</Label>
          <Input
            id="cik"
            name="cik"
            placeholder="e.g. 1336528"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Fund Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Pershing Square"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="strategyGroup">Strategy Group</Label>
          <Select name="strategyGroup" required>
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding...' : 'Add Fund'}
      </Button>
    </form>
  )
}
