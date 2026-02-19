import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Planning document reader
// ---------------------------------------------------------------------------

interface PlanningDoc {
  name: string
  relativePath: string
  content: string
  summary: string
}

function extractSummary(content: string): string {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
  // Skip the first heading, return the first non-heading non-empty line
  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (line.startsWith('---')) continue
    if (line.startsWith('**') && line.endsWith('**')) continue
    // Truncate long lines
    return line.length > 120 ? line.slice(0, 117) + '...' : line
  }
  return lines[0] ?? ''
}

function readPlanningDocs(dir: string, basePath: string): PlanningDoc[] {
  const docs: PlanningDoc[] = []
  if (!existsSync(dir)) return docs

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      docs.push(...readPlanningDocs(fullPath, basePath))
    } else if (entry.name.endsWith('.md')) {
      const content = readFileSync(fullPath, 'utf-8')
      docs.push({
        name: entry.name,
        relativePath: relative(basePath, fullPath),
        content,
        summary: extractSummary(content),
      })
    }
  }
  return docs
}

// ---------------------------------------------------------------------------
// Phase structure for organizing docs
// ---------------------------------------------------------------------------

interface PhaseGroup {
  label: string
  dirName: string
  docs: PlanningDoc[]
}

function organizeByPhase(docs: PlanningDoc[]): { topLevel: PlanningDoc[]; phases: PhaseGroup[] } {
  const topLevel: PlanningDoc[] = []
  const phaseMap = new Map<string, PlanningDoc[]>()

  const phaseLabels: Record<string, string> = {
    '01-data-foundation': 'Phase 1: Data Foundation',
    '02-analytics-engine': 'Phase 2: Analytics Engine',
    '03-dashboard': 'Phase 3: Dashboard',
  }

  for (const doc of docs) {
    const parts = doc.relativePath.split('/')
    if (parts[0] === 'phases' && parts.length >= 3) {
      const phaseDir = parts[1]
      if (!phaseMap.has(phaseDir)) phaseMap.set(phaseDir, [])
      phaseMap.get(phaseDir)!.push(doc)
    } else if (parts[0] === 'research') {
      const researchKey = '__research__'
      if (!phaseMap.has(researchKey)) phaseMap.set(researchKey, [])
      phaseMap.get(researchKey)!.push(doc)
    } else {
      topLevel.push(doc)
    }
  }

  const phases: PhaseGroup[] = []

  // Research first
  if (phaseMap.has('__research__')) {
    phases.push({ label: 'Research', dirName: 'research', docs: phaseMap.get('__research__')! })
  }

  // Phases in order
  for (const [dirName, label] of Object.entries(phaseLabels)) {
    if (phaseMap.has(dirName)) {
      phases.push({ label, dirName, docs: phaseMap.get(dirName)! })
    }
  }

  return { topLevel, phases }
}

// ---------------------------------------------------------------------------
// Build stats
// ---------------------------------------------------------------------------

const BUILD_STATS = {
  startTime: '2026-02-19 00:25',
  endTime: '2026-02-19 05:44',
  elapsed: '5h 19m',
  phases: 3,
  plans: 8,
  totalCommits: 37,
  executionPlans: 8,
  humanTimeInvested: '~37 min',
  estimatedTokens: '~2M',
  testsWritten: 33,
  requirements: 27,
}

// ---------------------------------------------------------------------------
// Iteration log (post-v1 user testing)
// ---------------------------------------------------------------------------

const ITERATION_LOG = [
  {
    title: 'CUSIP Scientific Notation Bug',
    description: 'CUSIPs like "37959E106" were being parsed as scientific notation (3.7959e+109) by fast-xml-parser. Fixed by setting parseTagValue: false.',
    commit: 'e49f0ed',
    type: 'bug' as const,
  },
  {
    title: 'Duplicate Holdings Deduplication',
    description: 'Multi-manager funds list the same security multiple times in 13F filings. Added deduplication by (cusip, putCall) with aggregation of shares/value.',
    commit: 'e49f0ed',
    type: 'bug' as const,
  },
  {
    title: 'Wrong CIK Corrections',
    description: 'Some fund CIKs in the initial config were incorrect, causing mismatched data. Corrected CIK mappings for affected funds.',
    commit: 'e49f0ed',
    type: 'bug' as const,
  },
  {
    title: 'Data Completeness Tracker + /status Page',
    description: 'Added a comprehensive data quality dashboard showing fund coverage, CUSIP resolution rates, and per-quarter holding counts.',
    commit: 'c8cbe94',
    type: 'feature' as const,
  },
  {
    title: 'Quarter Picker Fix',
    description: 'Quarter selector was not triggering server re-render on change. Fixed to properly update all data views.',
    commit: '85f9041',
    type: 'bug' as const,
  },
  {
    title: 'Navigation Bar + /manage Page',
    description: 'Added a persistent navigation bar and a fund management page for adding/removing funds from groups.',
    commit: '592cd93',
    type: 'feature' as const,
  },
  {
    title: 'Charts Page (Sankey, QoQ Comparison)',
    description: 'Built a charts page with Sankey flow diagrams showing capital movement and QoQ comparison charts across groups.',
    commit: 'db74793',
    type: 'feature' as const,
  },
  {
    title: 'Quarter Picker Restriction',
    description: 'Restricted quarter picker to last two quarters to avoid showing quarters with incomplete data.',
    commit: '9d2ce28',
    type: 'bug' as const,
  },
  {
    title: 'hideEmpty Filter + Multiple Bug Fixes',
    description: 'Added a filter to hide funds without data in both quarters. Fixed multiple issues: default mismatch, comparison population filtering, stat counting.',
    commit: '4e24273',
    type: 'feature' as const,
  },
  {
    title: 'Add Fund Modal with SEC Search',
    description: 'Added a modal on the groups page to search SEC EDGAR for funds by name and add them with one click. Fixed ticker resolution banner display.',
    commit: 'fed90f6',
    type: 'feature' as const,
  },
  {
    title: 'Mobile Hydration Error',
    description: 'Quarter picker checkbox switched from uncontrolled to controlled after mount, and Radix Select caused hydration mismatch on mobile Chrome. Fixed with mounted gate and suppressHydrationWarning.',
    commit: 'e6dc960',
    type: 'bug' as const,
  },
]

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function LogPage() {
  const planningDir = join(process.cwd(), '.planning')
  const allDocs = readPlanningDocs(planningDir, planningDir)
  const { topLevel, phases } = organizeByPhase(allDocs)

  const fixes = ITERATION_LOG.filter((item) => item.type === 'bug')
  const features = ITERATION_LOG.filter((item) => item.type === 'feature')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Build Log</h1>
        <p className="text-muted-foreground">
          Project build history, iteration log, and planning documents
        </p>
      </div>

      {/* Build Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Build Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBox label="Elapsed Time" value={BUILD_STATS.elapsed} />
            <StatBox label="Phases" value={String(BUILD_STATS.phases)} />
            <StatBox label="Execution Plans" value={String(BUILD_STATS.executionPlans)} />
            <StatBox label="Total Commits" value={String(BUILD_STATS.totalCommits)} />
            <StatBox label="Human Time Invested" value={BUILD_STATS.humanTimeInvested} />
            <StatBox label="Est. Tokens" value={BUILD_STATS.estimatedTokens} />
            <StatBox label="Requirements" value={String(BUILD_STATS.requirements)} />
            <StatBox label="Tests Written" value={String(BUILD_STATS.testsWritten)} />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              Built from {BUILD_STATS.startTime} to {BUILD_STATS.endTime} UTC.
              {' '}{BUILD_STATS.executionPlans} execution plans across {BUILD_STATS.phases} phases,
              {' '}{BUILD_STATS.humanTimeInvested} total human time invested.
              Estimated {BUILD_STATS.estimatedTokens} tokens
              ({BUILD_STATS.executionPlans} plans x ~50K avg per plan execution + research + iteration).
            </p>
            <p className="mt-1">
              Estimated developer time equivalent: ~2-3 weeks for an experienced full-stack developer.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Iteration Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Testing &amp; Iteration Log</CardTitle>
          <p className="text-sm text-muted-foreground">
            Post-v1 sessions: debugging, data corrections, and feature additions based on user testing
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fixes */}
          <details className="group rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 hover:bg-accent/50 transition-colors">
              <span className="font-medium text-sm">Fixes</span>
              <Badge variant="destructive">{fixes.length}</Badge>
            </summary>
            <div className="border-t px-4 py-3 space-y-2">
              {fixes.map((item, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  <code className="text-xs text-muted-foreground mt-1 inline-block">{item.commit}</code>
                </div>
              ))}
            </div>
          </details>

          {/* Feedback -> Features */}
          <details className="group rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 hover:bg-accent/50 transition-colors">
              <span className="font-medium text-sm">Feedback &rarr; Features</span>
              <Badge>{features.length}</Badge>
            </summary>
            <div className="border-t px-4 py-3 space-y-2">
              {features.map((item, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  <code className="text-xs text-muted-foreground mt-1 inline-block">{item.commit}</code>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Planning Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Planning Documents</CardTitle>
          <p className="text-sm text-muted-foreground">
            {allDocs.length} documents from the .planning/ directory
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top-level docs */}
          {topLevel.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">Project-Level</h3>
              <div className="space-y-2">
                {topLevel.map((doc) => (
                  <DocAccordion key={doc.relativePath} doc={doc} />
                ))}
              </div>
            </div>
          )}

          {/* Phase docs */}
          {phases.map((phase) => (
            <div key={phase.dirName}>
              <h3 className="font-medium text-sm mb-3">{phase.label}</h3>
              <div className="space-y-2">
                {phase.docs.map((doc) => (
                  <DocAccordion key={doc.relativePath} doc={doc} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function DocAccordion({ doc }: { doc: PlanningDoc }) {
  return (
    <details className="group rounded-lg border">
      <summary className="cursor-pointer px-4 py-2 text-sm hover:bg-accent/50 transition-colors">
        <span className="ml-1 font-medium">{doc.relativePath}</span>
        <span className="ml-2 text-muted-foreground text-xs">{doc.summary}</span>
      </summary>
      <div className="border-t px-4 py-3">
        <pre className="text-xs whitespace-pre-wrap overflow-x-auto text-muted-foreground leading-relaxed">
          {doc.content}
        </pre>
      </div>
    </details>
  )
}
