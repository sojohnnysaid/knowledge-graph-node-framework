import { useMemo, useRef, useState } from 'react'
import { KnowledgeGraph } from './framework'
import { areasOfInterest, buildGraphData } from './knowledgeGraphData'
import './App.css'

function App() {
  const graphRef = useRef(null)
  const graphData = useMemo(() => buildGraphData(), [])
  const [quality, setQuality] = useState('balanced')

  const handleQualityChange = (mode) => {
    setQuality(mode)
    graphRef.current?.setQuality(mode)
  }

  return (
    <div className="demo-page">
      <div className="demo-card">
        <div className="demo-toolbar">
          <strong>KnowledgeGraph Framework Demo</strong>
          <div className="toolbar-actions">
            <button onClick={() => graphRef.current?.focusAll()}>Focus All</button>
            {areasOfInterest.map((group) => (
              <button key={group.id} onClick={() => graphRef.current?.focusGroup(group.id)}>
                {group.label}
              </button>
            ))}
            <select value={quality} onChange={(event) => handleQualityChange(event.target.value)}>
              <option value="high">High</option>
              <option value="balanced">Balanced</option>
              <option value="performance">Performance</option>
            </select>
          </div>
        </div>

        <div className="graph-container">
          <KnowledgeGraph
            ref={graphRef}
            data={graphData}
            groups={areasOfInterest.map((group) => ({ id: group.id, nodeIds: group.focusNodeIds }))}
            qualityMode="balanced"
            initialFocus={{ type: 'all' }}
            autoFocusOnNodeClick
            dimInactive
          />
        </div>
      </div>
    </div>
  )
}

export default App
