# Knowledge Graph Node Framework

Embeddable React framework for rendering and organizing interactive 3D knowledge-node groups inside any container on a webpage.

This package is visual-only: no side panel UI is included.

## Features

- 3D force-directed node graph using `r3f-forcegraph`
- Group-based focus API (`focusGroup`, `focusNodes`, `focusAll`)
- Auto camera framing for selected node sets/groups
- Click-to-focus neighborhood behavior
- Optional in-scene hover tooltip
- Runtime quality presets (`high`, `balanced`, `performance`)
- Works in partial page regions (does not require full-window canvas)

## Install

```bash
npm install knowledge-graph-node-framework react react-dom three @react-three/fiber @react-three/drei r3f-forcegraph
```

## Basic Usage

```jsx
import { useRef } from 'react'
import { KnowledgeGraph } from 'knowledge-graph-node-framework'

const data = {
  nodes: [
    { id: 'a', label: 'Node A', category: 'Topic', val: 10, color: '#58b6ff' },
    { id: 'b', label: 'Node B', category: 'Topic', val: 8, color: '#ff8a3d' },
    { id: 'c', label: 'Node C', category: 'Topic', val: 7, color: '#59d19a' },
  ],
  links: [
    { source: 'a', target: 'b', strength: 2 },
    { source: 'b', target: 'c', strength: 1 },
  ],
}

const groups = [
  { id: 'cluster-1', nodeIds: ['a', 'b'] },
  { id: 'cluster-2', nodeIds: ['b', 'c'] },
]

export default function Example() {
  const graphRef = useRef(null)

  return (
    <div style={{ width: 800, height: 500 }}>
      <KnowledgeGraph
        ref={graphRef}
        data={data}
        groups={groups}
        initialFocus={{ type: 'all' }}
        qualityMode="balanced"
        autoFocusOnNodeClick
      />
    </div>
  )
}
```

## Imperative API (via `ref`)

```js
graphRef.current.focusAll()
graphRef.current.focusNodes(['a', 'b'])
graphRef.current.focusGroup('cluster-1')
graphRef.current.setQuality('performance')
const snapshot = graphRef.current.getSnapshot()
```

## Component API

`KnowledgeGraph` props:

- `data`: `{ nodes: Node[], links: Link[] }` (required)
- `groups`: `{ id: string, nodeIds: string[] }[]`
- `qualityMode`: `'high' | 'balanced' | 'performance'`
- `initialFocus`: `{ type: 'all' } | { type: 'group', groupId: string } | { type: 'nodes', nodeIds: string[] }`
- `autoFocusOnNodeClick`: `boolean` (default `true`)
- `dimInactive`: `boolean` (default `true`)
- `hoverTooltip`: `boolean` (default `true`)
- `tooltipRenderer(node)`: custom tooltip renderer
- `background`: background color (default `#07122e`)
- `fog`: `{ near: number, far: number } | false`
- `camera`: `{ position, fov, near, far, minDistance, maxDistance }`
- `onNodeClick(node, event)`
- `onNodeHover(node)`
- `onFocusChange({ type, nodeIds })`
- `className`, `style`

Node shape (minimum):

- `id: string`
- Optional: `label`, `category`, `val`, `color`, `summary`, `tags`

Link shape (minimum):

- `source: string`
- `target: string`
- Optional: `strength`, `color`, `relation`

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

The demo app in `src/App.jsx` shows how to embed the framework in a bounded container with external controls.
