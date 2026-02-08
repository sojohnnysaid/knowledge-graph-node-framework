import { useEffect, useMemo, useRef, useState } from 'react'
import { KnowledgeGraph } from './framework'
import { createIngestionPatch, createSaasDemoData } from './localDemoData'
import './App.css'

function App() {
  const graphRef = useRef(null)
  const demo = useMemo(() => createSaasDemoData(104), [])
  const defaultTeamId = demo.teams[0]?.id ?? 'all'
  const defaultDocId =
    demo.documents.find((doc) => doc.teamId === defaultTeamId)?.id ?? demo.documents[0]?.id ?? ''
  const [quality, setQuality] = useState('balanced')
  const [viewMode, setViewMode] = useState('workspace')
  const [selectedTeam, setSelectedTeam] = useState(defaultTeamId)
  const [selectedDoc, setSelectedDoc] = useState(defaultDocId)
  const [selectedUser, setSelectedUser] = useState('all')
  const [query, setQuery] = useState('')
  const initialTeamScope = useMemo(() => [defaultTeamId], [defaultTeamId])
  const initialFocus = useMemo(
    () => ({
      type: 'nodes',
      nodeIds: demo.nodes.filter((node) => node.documentId === defaultDocId).map((node) => node.id),
    }),
    [defaultDocId, demo.nodes],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!defaultDocId) return
      graphRef.current?.focusDocument(defaultDocId)
    }, 450)

    return () => clearTimeout(timer)
  }, [defaultDocId])

  const handleQualityChange = (mode) => {
    setQuality(mode)
    graphRef.current?.setQuality(mode)
  }

  const handleTeamScope = (teamId) => {
    setSelectedTeam(teamId)
    if (teamId === 'all') {
      graphRef.current?.clearTeamScope()
      return
    }
    graphRef.current?.setTeamScope([teamId])
    graphRef.current?.focusTeam(teamId)
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)

    if (mode === 'global') {
      setSelectedTeam('all')
      graphRef.current?.clearTeamScope()
      graphRef.current?.focusAll()
      return
    }

    const teamId = selectedTeam === 'all' ? defaultTeamId : selectedTeam
    setSelectedTeam(teamId)
    graphRef.current?.setTeamScope([teamId])
    graphRef.current?.focusTeam(teamId)
  }

  const handleFocusDocument = () => {
    if (!selectedDoc) return
    graphRef.current?.focusDocument(selectedDoc)
  }

  const handleUserScope = (userId) => {
    setSelectedUser(userId)
    if (userId === 'all') {
      graphRef.current?.clearUserScope()
      return
    }
    graphRef.current?.setUserScope([userId])
    graphRef.current?.focusUser(userId)
  }

  const handleSearch = () => {
    if (!query.trim()) return
    graphRef.current?.search(query, { focus: true, limit: 35 })
  }

  const handleSimulateIngestion = () => {
    const teamId = selectedTeam === 'all' ? demo.teams[0].id : selectedTeam
    const documentId = selectedDoc || demo.documents.find((doc) => doc.teamId === teamId)?.id
    if (!documentId) return
    const uploaderUserId =
      selectedUser === 'all'
        ? demo.users.find((user) => user.teamId === teamId)?.id
        : selectedUser
    const patch = createIngestionPatch(
      teamId,
      documentId,
      Math.floor(Date.now() % 10000),
      uploaderUserId,
    )
    graphRef.current?.upsertData(patch)
    graphRef.current?.focusDocument(documentId)
  }

  const filteredDocs = selectedTeam === 'all'
    ? demo.documents
    : demo.documents.filter((doc) => doc.teamId === selectedTeam)
  const filteredUsers = selectedTeam === 'all'
    ? demo.users
    : demo.users.filter((user) => user.teamId === selectedTeam)

  const renderDetailsPanel = (node) => (
    <div className="node-mini-popover">
      <strong>{node.label}</strong>
      <span>{node.teamId} · {node.documentId}</span>
      <span>uploaded by {node.uploadedByName ?? node.uploadedByUserId}</span>
      <span>{node.chunkType} · {node.sourceType} · confidence {node.confidence}</span>
      <p>{node.excerpt ?? node.summary}</p>
    </div>
  )

  return (
    <div className="demo-page">
      <div className="demo-card">
        <div className="demo-toolbar">
          <strong>Local SaaS Demo: Teams + RAG Knowledge Graph</strong>
          <div className="toolbar-actions">
            <select value={viewMode} onChange={(event) => handleViewModeChange(event.target.value)}>
              <option value="global">Global Map View</option>
              <option value="workspace">Team Workspace View</option>
            </select>
            <button onClick={() => graphRef.current?.focusAll()}>Focus All</button>

            <select value={quality} onChange={(event) => handleQualityChange(event.target.value)}>
              <option value="high">High</option>
              <option value="balanced">Balanced</option>
              <option value="performance">Performance</option>
            </select>

            <select
              value={selectedTeam}
              onChange={(event) => handleTeamScope(event.target.value)}
              disabled={viewMode === 'workspace' && selectedTeam === 'all'}
            >
              <option value="all" disabled={viewMode === 'workspace'}>All Teams</option>
              {demo.teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>

            <select value={selectedDoc} onChange={(event) => setSelectedDoc(event.target.value)}>
              <option value="">Select Document</option>
              {filteredDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>

            <button onClick={handleFocusDocument}>Focus Document</button>

            <select value={selectedUser} onChange={(event) => handleUserScope(event.target.value)}>
              <option value="all">All Uploaders</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chunks or tags"
            />
            <button onClick={handleSearch}>Search Focus</button>

            <button onClick={handleSimulateIngestion}>Simulate Ingestion Patch</button>
          </div>
        </div>

        <div className="graph-container">
          <KnowledgeGraph
            ref={graphRef}
            data={{ nodes: demo.nodes, links: demo.links }}
            groups={demo.groups.map((group) => ({ id: group.id, nodeIds: group.nodeIds }))}
            teamKey="teamId"
            documentKey="documentId"
            userKey="uploadedByUserId"
            userDisplayNameKey="uploadedByName"
            userProfiles={demo.userProfiles}
            qualityMode="balanced"
            initialFocus={initialFocus}
            initialTeamScope={initialTeamScope}
            autoFocusOnNodeClick
            dimInactive
            showCrossTeamLinks
            detailTrigger="click"
            detailPanelPlacement="middle-right"
            detailPanelOffset={{ x: 0, y: 0 }}
            detailRenderer={renderDetailsPanel}
          />
        </div>
      </div>
    </div>
  )
}

export default App
