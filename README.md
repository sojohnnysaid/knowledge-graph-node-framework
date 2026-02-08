# Knowledge Graph Node Framework

Embeddable React framework for rendering and organizing 3D knowledge graphs inside any bounded UI region.

Designed for SaaS products with multi-team document ingestion (RAG), uploader attribution, and interactive knowledge exploration.

## What It Solves

- Render a navigable graph in a dashboard card/panel (not full window required)
- Model tenant/team/document/user attribution on nodes
- Focus by team, user, document, group, or arbitrary node set
- Support incremental ingestion updates (`upsertData`) without remounts
- Provide stable click-driven detail panels (2D overlay, configurable placement)
- Tune runtime quality (`high`, `balanced`, `performance`)

## Install

```bash
npm install knowledge-graph-node-framework react react-dom three @react-three/fiber @react-three/drei r3f-forcegraph
```

## Minimal Embed

```jsx
import { useRef } from 'react'
import { KnowledgeGraph } from 'knowledge-graph-node-framework'

export default function KnowledgePanel({ graphData, groups, userProfiles }) {
  const graphRef = useRef(null)

  return (
    <div style={{ width: '100%', height: 520 }}>
      <KnowledgeGraph
        ref={graphRef}
        data={graphData}
        groups={groups}
        teamKey="teamId"
        documentKey="documentId"
        userKey="uploadedByUserId"
        userDisplayNameKey="uploadedByName"
        userProfiles={userProfiles}
        qualityMode="balanced"
        detailTrigger="click"
        detailPanelPlacement="middle-right"
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
- `uploadedByUserId?: string` (or custom key via `userKey`)
- `uploadedByName?: string` (or custom key via `userDisplayNameKey`)

Link fields:

- `source: string` (required)
- `target: string` (required)
- `strength?: number`
- `relation?: string`
- `color?: string`

## Component Props

- `data`: `{ nodes: Node[], links: Link[] }` (required)
- `groups`: `{ id: string, nodeIds: string[] }[]`
- `teamKey`: node field for team id (default `teamId`)
- `documentKey`: node field for document id (default `documentId`)
- `userKey`: node field for uploader user id (default `uploadedByUserId`)
- `userDisplayNameKey`: node field for uploader display name (default `uploadedByName`)
- `userProfiles`: `{ [userId]: { name?: string, displayName?: string, teamId?: string } }`
- `teamColors`: `{ [teamId]: color }`
- `initialTeamScope`: `string[] | null`
- `initialUserScope`: `string[] | null`
- `hiddenTeamIds`: `string[]`
- `hiddenUserIds`: `string[]`
- `showCrossTeamLinks`: `boolean` (default `true`)
- `qualityMode`: `'high' | 'balanced' | 'performance'`
- `initialFocus`: `{ type: 'all' } | { type: 'group', groupId } | { type: 'nodes', nodeIds }`
- `autoFocusOnNodeClick`: `boolean` (default `true`)
- `dimInactive`: `boolean` (default `true`)
- `detailTrigger`: `'click' | 'hover'` (default `click`)
- `showDetailPanel`: `boolean` (default `true`)
- `detailPanelPlacement`: `'top-right' | 'middle-right' | 'bottom-right'`
- `detailPanelOffset`: `{ x?: number, y?: number }`
- `detailRenderer(node)`: custom detail panel renderer
- `background`: color (default `#07122e`)
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
- `focusUser(userId: string)`
- `focusDocument(documentId: string)`
- `search(query: string, { limit = 25, focus = false })`
- `setTeamScope(teamIds: string[], { focus = true })`
- `clearTeamScope({ focus = true })`
- `setUserScope(userIds: string[], { focus = true })`
- `clearUserScope({ focus = true })`
- `setQuality(mode: 'high' | 'balanced' | 'performance')`
- `upsertData({ nodes?: Node[], links?: Link[] })`
- `listTeams()`
- `listUsers()`
- `listDocuments()`
- `getSnapshot()`

## SaaS Workflow Example (Team + User Attribution)

```jsx
// Ingestion patch with uploader attribution:
graphRef.current.upsertData({
  nodes: [
    {
      id: 'chunk-8844',
      label: 'Assessment Blueprint',
      teamId: 'team-instructional-design',
      documentId: 'doc-lxd-playbook',
      uploadedByUserId: 'user-avery',
      uploadedByName: 'Avery Chen',
      tags: ['assessment', 'rubric'],
      val: 6,
    },
  ],
  links: [{ source: 'chunk-8844', target: 'chunk-1011', relation: 'semantic-match', strength: 2 }],
})

// Scope graph to one team:
graphRef.current.setTeamScope(['team-instructional-design'])

// Scope to one uploader (user -> team -> docs):
graphRef.current.setUserScope(['user-avery'])

// Focus uploader contributions:
graphRef.current.focusUser('user-avery')

// Focus selected source document:
graphRef.current.focusDocument('doc-lxd-playbook')
```

## Quality Presets

- `high`: richest visuals
- `balanced`: good default
- `performance`: lowest compute, strongest culling

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

The local demo in `src/App.jsx` shows team workspace/global map behavior, user attribution, document focus, and simulated ingestion patches.
