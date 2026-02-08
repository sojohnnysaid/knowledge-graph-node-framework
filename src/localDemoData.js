const teamIds = ['team-alpha', 'team-bravo', 'team-charlie', 'team-delta']
const teamNames = {
  'team-alpha': 'Instructional Design',
  'team-bravo': 'Enablement Ops',
  'team-charlie': 'Compliance Learning',
  'team-delta': 'Product Academy',
}

const teamUsers = {
  'team-alpha': [
    { id: 'user-a1', name: 'Avery Chen' },
    { id: 'user-a2', name: 'Priya Singh' },
    { id: 'user-a3', name: 'Elena Torres' },
  ],
  'team-bravo': [
    { id: 'user-b1', name: 'Noah Patel' },
    { id: 'user-b2', name: 'Maya Rivera' },
    { id: 'user-b3', name: 'Jordan Park' },
  ],
  'team-charlie': [
    { id: 'user-c1', name: 'Liam Brooks' },
    { id: 'user-c2', name: 'Nina Morales' },
    { id: 'user-c3', name: 'Omar Khan' },
  ],
  'team-delta': [
    { id: 'user-d1', name: 'Harper Lee' },
    { id: 'user-d2', name: 'Sofia Kim' },
    { id: 'user-d3', name: 'Mateo Alvarez' },
  ],
}

function rng(seed) {
  let x = seed
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

function toDocId(teamId, idx) {
  return `${teamId}-doc-${String(idx).padStart(3, '0')}`
}

function toChunkId(teamId, docIdx, chunkIdx) {
  return `${teamId}-d${String(docIdx).padStart(3, '0')}-c${String(chunkIdx).padStart(3, '0')}`
}

export function createSaasDemoData(seed = 42) {
  const rand = rng(seed)
  const nodes = []
  const links = []
  const groups = []
  const documents = []
  const users = []
  const userProfiles = {}

  Object.entries(teamUsers).forEach(([teamId, list]) => {
    list.forEach((user) => {
      users.push({ ...user, teamId })
      userProfiles[user.id] = { name: user.name, teamId }
    })
  })

  teamIds.forEach((teamId, tIdx) => {
    const docCount = 10 + tIdx * 2
    const teamNodeIds = []

    for (let d = 1; d <= docCount; d += 1) {
      const documentId = toDocId(teamId, d)
      documents.push({
        id: documentId,
        teamId,
        title: `${teamNames[teamId]} Source ${d}`,
      })

      const chunkCount = 8 + (d % 5)
      const docNodeIds = []

      for (let c = 1; c <= chunkCount; c += 1) {
        const id = toChunkId(teamId, d, c)
        const node = {
          id,
          label: `${teamNames[teamId]}: Chunk ${d}.${c}`,
          category: c % 2 === 0 ? 'Course Design' : 'Knowledge Chunk',
          teamId,
          documentId,
          uploadedByUserId: teamUsers[teamId][Math.floor(rand() * teamUsers[teamId].length)].id,
          sourceType: d % 3 === 0 ? 'PDF' : d % 3 === 1 ? 'Confluence' : 'Notion',
          confidence: Number((0.62 + rand() * 0.37).toFixed(2)),
          chunkType: c % 3 === 0 ? 'Assessment' : c % 2 === 0 ? 'Activity' : 'Concept',
          tags: [
            c % 3 === 0 ? 'assessment' : 'content',
            d % 2 === 0 ? 'module' : 'activity',
            tIdx % 2 === 0 ? 'rag-indexed' : 'ai-curated',
          ],
          summary: `Ingested chunk ${c} from ${documentId} for ${teamNames[teamId]}.`,
          excerpt: `This chunk covers ${c % 2 === 0 ? 'instruction sequencing' : 'learning objective alignment'} and reusable guidance for ${teamNames[teamId]}.`,
          val: 5 + Math.floor(rand() * 7),
        }
        node.uploadedByName = userProfiles[node.uploadedByUserId]?.name

        nodes.push(node)
        teamNodeIds.push(id)
        docNodeIds.push(id)

        if (c > 1) {
          links.push({
            source: toChunkId(teamId, d, c - 1),
            target: id,
            relation: 'doc-sequence',
            strength: 1 + Math.floor(rand() * 2),
          })
        }
      }

      groups.push({
        id: documentId,
        label: `${teamNames[teamId]} · Doc ${d}`,
        nodeIds: docNodeIds,
      })

      if (d > 1) {
        links.push({
          source: toChunkId(teamId, d - 1, 1),
          target: toChunkId(teamId, d, 1),
          relation: 'curriculum-path',
          strength: 2,
        })
      }
    }

    groups.push({
      id: teamId,
      label: `${teamNames[teamId]} Team`,
      nodeIds: teamNodeIds,
    })
  })

  const allDocNodes = nodes.filter((node) => node.documentId.endsWith('001') || node.documentId.endsWith('002'))
  for (let i = 0; i < 120; i += 1) {
    const a = allDocNodes[Math.floor(rand() * allDocNodes.length)]
    const b = allDocNodes[Math.floor(rand() * allDocNodes.length)]
    if (!a || !b || a.id === b.id) continue
    links.push({
      source: a.id,
      target: b.id,
      relation: a.teamId === b.teamId ? 'semantic-near' : 'cross-team-near',
      strength: a.teamId === b.teamId ? 1 : 2,
    })
  }

  return {
    nodes,
    links,
    groups,
    teams: teamIds.map((id) => ({ id, name: teamNames[id] })),
    documents,
    users,
    userProfiles,
  }
}

export function createIngestionPatch(teamId, documentId, startIndex = 900, uploaderUserId = null) {
  const nodes = []
  const links = []
  const fallbackUserId = teamUsers[teamId]?.[0]?.id ?? `user-${teamId}`
  const uploadedByUserId = uploaderUserId ?? fallbackUserId

  for (let i = 0; i < 4; i += 1) {
    const id = `${teamId}-ingest-${documentId}-${startIndex + i}`
    nodes.push({
      id,
      label: `Ingested ${documentId} chunk ${i + 1}`,
      category: 'New Ingestion',
      teamId,
      documentId,
      uploadedByUserId,
      uploadedByName: (teamUsers[teamId] ?? []).find((u) => u.id === uploadedByUserId)?.name ?? 'Unknown User',
      sourceType: 'Upload',
      confidence: 0.88,
      chunkType: i % 2 === 0 ? 'Concept' : 'Activity',
      tags: ['ingestion', 'new', 'rag-indexed'],
      summary: `Freshly ingested chunk ${i + 1} for ${documentId}.`,
      excerpt: `Newly embedded content snippet ${i + 1} from ${documentId}.`,
      val: 6,
    })

    if (i > 0) {
      links.push({
        source: `${teamId}-ingest-${documentId}-${startIndex + i - 1}`,
        target: id,
        relation: 'ingestion-sequence',
        strength: 2,
      })
    }
  }

  return { nodes, links }
}
