'use client'

import { useState } from 'react'
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

const NEW_GROUP_VALUE = '__new__'

function submitAction(_prev: { error?: string }, formData: FormData) {
  return addFund(formData)
}

export function AddFundForm({ groups }: AddFundFormProps) {
  const [state, action, pending] = useActionState(submitAction, {})
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('')

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
          <Label>Strategy Group</Label>
          {showNewGroup ? (
            <div className="flex gap-2">
              <Input
                name="strategyGroup"
                placeholder="New group name"
                required
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setShowNewGroup(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <input type="hidden" name="strategyGroup" value={selectedGroup} />
              <Select
                value={selectedGroup}
                onValueChange={(v) => {
                  if (v === NEW_GROUP_VALUE) {
                    setShowNewGroup(true)
                    setSelectedGroup('')
                  } else {
                    setSelectedGroup(v)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_GROUP_VALUE}>
                    + New group...
                  </SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
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
