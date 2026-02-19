'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { addFund, ingestNewFund } from '@/app/manage/actions'

interface SearchResult {
  cik: string
  name: string
  ticker: string
}

interface AddFundModalProps {
  existingGroups: string[]
}

type SubmitPhase = 'idle' | 'adding' | 'ingesting' | 'done' | 'error'

const NEW_GROUP_VALUE = '__new__'

export function AddFundModal({ existingGroups }: AddFundModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Form state
  const [fundName, setFundName] = useState('')
  const [cik, setCik] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  // Submit state
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [ingestResult, setIngestResult] = useState<{ quartersProcessed: number; totalHoldings: number } | null>(null)

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)
      setFundName('')
      setCik('')
      setSelectedGroup('')
      setShowNewGroup(false)
      setNewGroupName('')
      setPhase('idle')
      setErrorMsg('')
      setIngestResult(null)
    }
  }, [open])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/search-funds?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: SearchResult[] = await res.json()
        setSearchResults(data)
        setShowDropdown(data.length > 0)
      }
    } catch {
      // Silently fail search
    } finally {
      setSearching(false)
    }
  }, [])

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => doSearch(value), 300)
  }

  function handleSelectResult(result: SearchResult) {
    setFundName(result.name)
    setCik(result.cik)
    setSearchQuery(`${result.name} (${result.ticker})`)
    setShowDropdown(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setIngestResult(null)

    const strategyGroup = showNewGroup ? newGroupName.trim() : selectedGroup
    if (!cik || !fundName || !strategyGroup) {
      setErrorMsg('All fields are required.')
      setPhase('error')
      return
    }

    // Phase 1: Add fund to config + DB
    setPhase('adding')
    const formData = new FormData()
    formData.set('cik', cik.trim())
    formData.set('name', fundName.trim())
    formData.set('strategyGroup', strategyGroup)

    const addResult = await addFund(formData)
    if (addResult.error) {
      setErrorMsg(addResult.error)
      setPhase('error')
      return
    }

    // Phase 2: Ingest SEC data
    setPhase('ingesting')
    const ingest = await ingestNewFund(cik.trim())
    if (ingest.error) {
      setErrorMsg(ingest.error)
      setPhase('error')
      return
    }

    setIngestResult(ingest.result ?? null)
    setPhase('done')

    // Auto-close after short delay
    setTimeout(() => {
      setOpen(false)
      router.refresh()
    }, 1500)
  }

  const isSubmitting = phase === 'adding' || phase === 'ingesting'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex h-full min-h-[200px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
          type="button"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            <span className="text-sm font-medium">Add Fund</span>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Fund</DialogTitle>
          <DialogDescription>
            Search for a fund by name, ticker, or CIK. Data will be fetched from SEC EDGAR automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fund search */}
          <div className="space-y-2" ref={dropdownRef}>
            <Label htmlFor="fund-search">Search SEC Filers</Label>
            <div className="relative">
              <Input
                id="fund-search"
                placeholder="e.g. Pershing Square, AAPL, 1336528"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
                disabled={isSubmitting}
                autoComplete="off"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                </div>
              )}
              {showDropdown && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                  {searchResults.map((r) => (
                    <button
                      key={`${r.cik}-${r.ticker}`}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                      onClick={() => handleSelectResult(r)}
                    >
                      <span className="font-medium truncate">{r.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {r.ticker} &middot; CIK {r.cik}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fund name */}
          <div className="space-y-2">
            <Label htmlFor="fund-name">Fund Name</Label>
            <Input
              id="fund-name"
              placeholder="e.g. Pershing Square Capital Management"
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* CIK */}
          <div className="space-y-2">
            <Label htmlFor="fund-cik">CIK Number</Label>
            <Input
              id="fund-cik"
              placeholder="e.g. 1336528"
              value={cik}
              onChange={(e) => setCik(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Strategy group */}
          <div className="space-y-2">
            <Label>Strategy Group</Label>
            {showNewGroup ? (
              <div className="flex gap-2">
                <Input
                  placeholder="New group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={isSubmitting}
                  required
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => { setShowNewGroup(false); setNewGroupName('') }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
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
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {existingGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_GROUP_VALUE}>
                    + New group...
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Status messages */}
          {phase === 'error' && errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
          {phase === 'adding' && (
            <p className="text-sm text-muted-foreground">Adding fund...</p>
          )}
          {phase === 'ingesting' && (
            <p className="text-sm text-muted-foreground">Fetching SEC data... This may take a moment.</p>
          )}
          {phase === 'done' && ingestResult && (
            <p className="text-sm text-green-600">
              Done! {ingestResult.quartersProcessed} quarter(s), {ingestResult.totalHoldings} holdings ingested.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || phase === 'done'}>
              {phase === 'adding'
                ? 'Adding...'
                : phase === 'ingesting'
                  ? 'Fetching SEC data...'
                  : phase === 'done'
                    ? 'Done!'
                    : 'Add Fund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
