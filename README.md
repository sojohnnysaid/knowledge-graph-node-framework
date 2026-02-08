# Knowledge Graph Node Framework

Embeddable React framework for rendering and organizing 3D knowledge graphs inside any bounded UI region.

Built for product scenarios like AI course-generation SaaS with multi-team document ingestion and RAG-backed knowledge mapping.

## What It Solves

- Render a navigable knowledge graph in a card/panel (not full window required)
- Handle multi-team knowledge nodes in one graph
- Focus by team, document, or arbitrary node set
- Support incremental ingestion updates without rebuilding the app
- Keep performance tunable with runtime quality presets

## Install

```bash
npm install knowledge-graph-node-framework react react-dom three @react-three/fiber @react-three/drei r3f-forcegraph
```

## Minimal Embed

```jsx
import { useRef } from 'react'
import { KnowledgeGraph } from 'knowledge-graph-node-framework'

export default function KnowledgePanel({ graphData, groups }) {
  const graphRef = useRef(null)

  return (
    <div style={{ width: '100%', height: 520 }}>
      <KnowledgeGraph
        ref={graphRef}
        data={graphData}
        groups={groups}
        qualityMode="balanced"
        initialFocus={{ type: 'all' }}
      />
    </div>
  )
}
```

## Data Model

Node fields (recommended):

- `id: string` (required)
- `label?: string`
- `category?: string`
- `val?: number`
- `color?: string`
- `tags?: string[]`
- `summary?: string`
- `teamId?: string` (or custom key via `teamKey`)
- `documentId?: string` (or custom key via `documentKey`)

Link fields (required):

- `source: string`
- `target: string`

Optional link fields:

- `strength?: number`
- `relation?: string`
- `color?: string`

## Component Props

- `data`: `{ nodes: Node[], links: Link[] }` (required)
- `groups`: `{ id: string, nodeIds: string[] }[]`
- `teamKey`: node field name for team ID (default `teamId`)
- `documentKey`: node field name for document ID (default `documentId`)
- `teamColors`: map of teamId -> color
- `initialTeamScope`: `string[] | null`
- `hiddenTeamIds`: `string[]`
- `showCrossTeamLinks`: `boolean` (default `true`)
- `qualityMode`: `'high' | 'balanced' | 'performance'`
- `initialFocus`: `{ type: 'all' } | { type: 'group', groupId } | { type: 'nodes', nodeIds }`
- `autoFocusOnNodeClick`: `boolean` (default `true`)
- `dimInactive`: `boolean` (default `true`)
- `hoverTooltip`: `boolean` (default `true`)
- `tooltipRenderer(node)`: custom tooltip renderer
- `background`: string (default `#07122e`)
- `fog`: `{ near: number, far: number } | false`
- `camera`: `{ position, fov, near, far, minDistance, maxDistance }`
- `onNodeClick(node, event)`
- `onNodeHover(node)`
- `onFocusChange({ type, nodeIds })`
- `className`, `style`

## Imperative API (`ref`)

- `focusAll()`
- `focusNodes(nodeIds: string[])`
- `focusGroup(groupId: string)`
- `focusTeam(teamId: string)`
- `focusDocument(documentId: string)`
- `search(query: string, { limit = 25, focus = false })`
- `setTeamScope(teamIds: string[], { focus = true })`
- `clearTeamScope({ focus = true })`
- `setQuality(mode: 'high' | 'balanced' | 'performance')`
- `upsertData({ nodes?: Node[], links?: Link[] })`
- `listTeams()`
- `listDocuments()`
- `getSnapshot()`

## SaaS Workflow Example (Teams + RAG)

```jsx
// During ingestion completion (streaming patch):
graphRef.current.upsertData({
  nodes: [
    {
      id: 'chunk-8844',
      label: 'Gagne Nine Events Summary',
      teamId: 'team-instructional-design',
      documentId: 'doc-lxd-playbook',
      tags: ['instructional design', 'pedagogy'],
      val: 6,
    },
  ],
  links: [
    { source: 'chunk-8844', target: 'chunk-1011', relation: 'semantic-match', strength: 2 },
  ],
})

// Filter graph to one team:
graphRef.current.setTeamScope(['team-instructional-design'])

// Focus all nodes from a selected source document:
graphRef.current.focusDocument('doc-lxd-playbook')

// Search and focus matches:
const matches = graphRef.current.search('assessment rubric', { focus: true, limit: 30 })
```

## Quality Presets

- `high`: richest visuals
- `balanced`: good default for most apps
- `performance`: lowest compute, strongest culling

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

The demo in `src/App.jsx` shows an embedded graph with external controls, intended as integration reference.
