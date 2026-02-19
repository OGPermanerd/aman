'use client'

import { Sankey, Tooltip, Layer, Rectangle } from 'recharts'
import { formatCurrency } from '@/lib/formatters'

export interface SankeyFlowData {
  previousTotal: number
  currentTotal: number
  newValue: number
  exitedValue: number
  increasedFrom: number
  increasedTo: number
  decreasedFrom: number
  decreasedTo: number
  unchangedValue: number
}

// Colors for each flow type
const FLOW_COLORS: Record<string, string> = {
  new: '#22c55e',       // green
  exited: '#ef4444',    // red
  increased: '#3b82f6', // blue
  decreased: '#f97316', // orange
  unchanged: '#a1a1aa', // gray
}

function buildSankeyData(flow: SankeyFlowData) {
  // Nodes: [0] Prior Q, [1] Current Q, [2] New, [3] Exited, [4] Increased, [5] Decreased, [6] Unchanged
  const nodes = [
    { name: 'Prior Quarter' },
    { name: 'Current Quarter' },
    { name: 'New Positions' },
    { name: 'Exited' },
    { name: 'Increased' },
    { name: 'Decreased' },
    { name: 'Unchanged' },
  ]

  const links: Array<{ source: number; target: number; value: number; flowType: string }> = []

  // From Prior Quarter out
  if (flow.exitedValue > 0) {
    links.push({ source: 0, target: 3, value: flow.exitedValue, flowType: 'exited' })
  }
  if (flow.increasedFrom > 0) {
    links.push({ source: 0, target: 4, value: flow.increasedFrom, flowType: 'increased' })
  }
  if (flow.decreasedFrom > 0) {
    links.push({ source: 0, target: 5, value: flow.decreasedFrom, flowType: 'decreased' })
  }
  if (flow.unchangedValue > 0) {
    links.push({ source: 0, target: 6, value: flow.unchangedValue, flowType: 'unchanged' })
  }

  // Into Current Quarter
  if (flow.newValue > 0) {
    links.push({ source: 2, target: 1, value: flow.newValue, flowType: 'new' })
  }
  if (flow.increasedTo > 0) {
    links.push({ source: 4, target: 1, value: flow.increasedTo, flowType: 'increased' })
  }
  if (flow.decreasedTo > 0) {
    links.push({ source: 5, target: 1, value: flow.decreasedTo, flowType: 'decreased' })
  }
  if (flow.unchangedValue > 0) {
    links.push({ source: 6, target: 1, value: flow.unchangedValue, flowType: 'unchanged' })
  }

  return { nodes, links }
}

const NODE_COLORS: Record<string, string> = {
  'Prior Quarter': '#6366f1',
  'Current Quarter': '#6366f1',
  'New Positions': '#22c55e',
  'Exited': '#ef4444',
  'Increased': '#3b82f6',
  'Decreased': '#f97316',
  'Unchanged': '#a1a1aa',
}

interface SankeyNodeProps {
  x: number
  y: number
  width: number
  height: number
  index: number
  payload: { name: string; value: number }
}

function SankeyNode({ x, y, width, height, index, payload }: SankeyNodeProps) {
  if (height < 1) return null
  const color = NODE_COLORS[payload.name] ?? '#6366f1'
  const isLeft = x < 200
  const isMiddle = x > 100 && x < 600

  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.9}
        rx={3}
        ry={3}
      />
      <text
        x={isLeft ? x - 8 : isMiddle ? x + width / 2 : x + width + 8}
        y={y + height / 2}
        textAnchor={isLeft ? 'end' : isMiddle ? 'middle' : 'start'}
        dominantBaseline="central"
        className="text-xs fill-foreground"
      >
        {payload.name}
      </text>
      <text
        x={isLeft ? x - 8 : isMiddle ? x + width / 2 : x + width + 8}
        y={y + height / 2 + 14}
        textAnchor={isLeft ? 'end' : isMiddle ? 'middle' : 'start'}
        dominantBaseline="central"
        className="text-[10px] fill-muted-foreground"
      >
        {formatCurrency(payload.value)}
      </text>
    </Layer>
  )
}

interface SankeyLinkTooltipPayload {
  payload: {
    source: { name: string }
    target: { name: string }
    value: number
    flowType: string
  }
}

function SankeyTooltip({ active, payload }: { active?: boolean; payload?: SankeyLinkTooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{data.source.name} &rarr; {data.target.name}</p>
      <p className="text-muted-foreground mt-1">{formatCurrency(data.value)}</p>
    </div>
  )
}

interface QoQSankeyProps {
  flow: SankeyFlowData
}

export function QoQSankey({ flow }: QoQSankeyProps) {
  const { nodes, links } = buildSankeyData(flow)

  if (links.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No flow data available for this quarter comparison.</p>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height: 450 }}>
      <Sankey
        width={900}
        height={420}
        data={{ nodes, links }}
        nodeWidth={16}
        nodePadding={24}
        margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
        link={{
          stroke: '#d4d4d8',
          strokeOpacity: 0.4,
        }}
        node={<SankeyNode x={0} y={0} width={0} height={0} index={0} payload={{ name: '', value: 0 }} />}
      >
        <Tooltip content={<SankeyTooltip />} />
      </Sankey>
    </div>
  )
}
