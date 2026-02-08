import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import R3fForceGraph from 'r3f-forcegraph'
import { DEFAULT_QUALITY_MODE, QUALITY_PRESETS } from './qualityPresets'

const VIEWPORT_PADDING = 48
const TEAM_PALETTE = ['#58b6ff', '#ff8a3d', '#59d19a', '#c4a2ff', '#ffd166', '#ff6e9f', '#40e1d0']
const EMPTY_ARRAY = []
const EMPTY_OBJECT = {}
const DEFAULT_INITIAL_FOCUS = { type: 'all' }

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function hashString(value) {
  const str = String(value ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getFocusedPositionedNodes(graphData, nodeIds) {
  const idSet = new Set(nodeIds)
  return graphData.nodes.filter(
    (node) =>
      idSet.has(node.id) &&
      Number.isFinite(node.x) &&
      Number.isFinite(node.y) &&
      Number.isFinite(node.z),
  )
}

function getAllPositionedNodes(graphData) {
  return graphData.nodes.filter(
    (node) => Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z),
  )
}

function computeWeightedCenter(nodes) {
  let sumW = 0
  let sx = 0
  let sy = 0
  let sz = 0

  nodes.forEach((node) => {
    const w = Math.max(node.val ?? 1, 1)
    sumW += w
    sx += node.x * w
    sy += node.y * w
    sz += node.z * w
  })

  return new THREE.Vector3(sx / sumW, sy / sumW, sz / sumW)
}

function computeBoundingSphereRadius(nodes, center) {
  let radius = 0
  nodes.forEach((node) => {
    const nodeRadius = Math.cbrt(Math.max(node.val ?? 1, 1)) * 6
    const distance = center.distanceTo(new THREE.Vector3(node.x, node.y, node.z)) + nodeRadius
    radius = Math.max(radius, distance)
  })
  return radius
}

function mergeGraphData(base, patch) {
  const baseNodes = base?.nodes ?? []
  const baseLinks = base?.links ?? []
  const patchNodes = patch?.nodes ?? []
  const patchLinks = patch?.links ?? []

  const nodeMap = new Map(baseNodes.map((node) => [node.id, node]))
  patchNodes.forEach((node) => nodeMap.set(node.id, { ...(nodeMap.get(node.id) ?? {}), ...node }))

  const linkKey = (link) => {
    const source = link.source?.id ?? link.source
    const target = link.target?.id ?? link.target
    return `${source}::${target}::${link.relation ?? ''}`
  }

  const linkMap = new Map(baseLinks.map((link) => [linkKey(link), link]))
  patchLinks.forEach((link) =>
    linkMap.set(linkKey(link), { ...(linkMap.get(linkKey(link)) ?? {}), ...link }),
  )

  return {
    nodes: [...nodeMap.values()],
    links: [...linkMap.values()],
  }
}

function SceneTelemetry({ controlsRef, viewStateRef }) {
  const { camera, size } = useThree()

  useFrame(() => {
    const target = controlsRef.current?.target ?? new THREE.Vector3(0, 0, 0)
    viewStateRef.current = {
      camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: target.x, y: target.y, z: target.z },
      fov: camera.fov,
      aspect: size.width / Math.max(size.height, 1),
      viewport: { width: size.width, height: size.height },
      capturedAt: new Date().toISOString(),
    }
  })

  return null
}

function GraphLayer({
  graphData,
  focusRequest,
  controlsRef,
  activeNodeIds,
  quality,
  onNodeClick,
  onNodeHover,
  detailTrigger,
  onDetailNodeChange,
  dimInactive,
}) {
  const fgRef = useRef(null)
  const animationRef = useRef(null)
  const lastHoverIdRef = useRef(null)
  const { camera, size } = useThree()
  const viewportWidth = size.width
  const viewportHeight = size.height
  const [hoverNode, setHoverNode] = useState(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const activeNodeIdSet = useMemo(() => new Set(activeNodeIds), [activeNodeIds])
  const isDense = graphData.nodes.length > 180
  const effectiveCooldownTicks = isDense ? Math.min(quality.cooldownTicks, 22) : quality.cooldownTicks
  const effectiveCooldownTime = isDense ? Math.min(quality.cooldownTime, 4000) : quality.cooldownTime
  const effectiveParticleIdle = isDense ? 0 : quality.directionalParticlesIdle
  const effectiveParticleHighlight = isDense ? 1 : quality.directionalParticlesHighlight

  useFrame(() => {
    fgRef.current?.tickFrame()

    const animation = animationRef.current
    if (!animation) return

    const tRaw = (performance.now() - animation.startAt) / animation.duration
    const t = clamp(tRaw, 0, 1)
    const easedT = easeInOutCubic(t)
    const nextCamera = animation.cameraCurve.getPoint(easedT)
    const nextTarget = animation.targetCurve.getPoint(easedT)

    camera.position.copy(nextCamera)

    if (controlsRef.current) {
      controlsRef.current.target.copy(nextTarget)
      controlsRef.current.update()
    } else {
      camera.lookAt(nextTarget)
    }

    if (t >= 1) {
      animationRef.current = null
    }
  })

  useEffect(() => {
    const forceGraph = fgRef.current
    if (!forceGraph) return

    const chargeForce = forceGraph.d3Force('charge')
    if (chargeForce) {
      chargeForce.strength(quality.chargeStrength)
      chargeForce.distanceMax(quality.chargeDistanceMax)
    }

    forceGraph.d3Force('link')?.distance(
      (link) => quality.linkDistanceBase + (link.strength ?? 1) * quality.linkDistanceScale,
    )
    forceGraph.d3ReheatSimulation()
  }, [quality, isDense])

  useEffect(() => {
    if (!focusRequest?.nodeIds?.length || !fgRef.current) return

    const included = new Set(focusRequest.nodeIds)
    const bbox = fgRef.current.getGraphBbox((node) => included.has(node.id))
    if (!bbox) return

    const bboxCenter = new THREE.Vector3(
      (bbox.x[0] + bbox.x[1]) / 2,
      (bbox.y[0] + bbox.y[1]) / 2,
      (bbox.z[0] + bbox.z[1]) / 2,
    )

    const bboxXSpan = Math.max(bbox.x[1] - bbox.x[0], 12)
    const bboxYSpan = Math.max(bbox.y[1] - bbox.y[0], 12)
    const bboxZSpan = Math.max(bbox.z[1] - bbox.z[0], 12)
    const bboxSpan = Math.max(bboxXSpan, bboxYSpan, bboxZSpan, 40)

    const currentTarget = controlsRef.current
      ? controlsRef.current.target.clone()
      : new THREE.Vector3(0, 0, 0)

    const startPos = camera.position.clone()
    const startDirection = startPos.clone().sub(currentTarget)
    if (startDirection.lengthSq() < 0.01) startDirection.set(0.35, 0.3, 0.88)
    startDirection.normalize()

    const focusedPositionedNodes = getFocusedPositionedNodes(graphData, focusRequest.nodeIds)
    const allPositionedNodes = getAllPositionedNodes(graphData)

    const isAreaFocus = focusRequest.kind === 'area'
    const finalTarget =
      focusedPositionedNodes.length >= 2 ? computeWeightedCenter(focusedPositionedNodes) : bboxCenter

    let xSpan = bboxXSpan
    let ySpan = bboxYSpan
    let zSpan = bboxZSpan
    let span = bboxSpan

    if (focusedPositionedNodes.length >= 2) {
      const xVals = focusedPositionedNodes.map((n) => n.x)
      const yVals = focusedPositionedNodes.map((n) => n.y)
      const zVals = focusedPositionedNodes.map((n) => n.z)
      xSpan = Math.max(Math.max(...xVals) - Math.min(...xVals), 12)
      ySpan = Math.max(Math.max(...yVals) - Math.min(...yVals), 12)
      zSpan = Math.max(Math.max(...zVals) - Math.min(...zVals), 12)
      span = Math.max(xSpan, ySpan, zSpan, 40)
    }

    let preferredDirection
    if (isAreaFocus && allPositionedNodes.length >= 2) {
      const globalCenter = computeWeightedCenter(allPositionedNodes)
      preferredDirection = finalTarget.clone().sub(globalCenter)
      if (preferredDirection.lengthSq() < 0.01) {
        preferredDirection.copy(startDirection)
      }
      preferredDirection.y *= 2.2
      preferredDirection.normalize()
    } else {
      preferredDirection = new THREE.Vector3(
        (startDirection.x >= 0 ? 1 : -1) * (0.68 + xSpan / (ySpan + zSpan + 1)),
        0.31 + ySpan / (xSpan + zSpan + 1),
        (startDirection.z >= 0 ? 1 : -1) * (0.84 + zSpan / (xSpan + ySpan + 1)),
      ).normalize()
    }

    const radius =
      focusedPositionedNodes.length >= 2
        ? computeBoundingSphereRadius(focusedPositionedNodes, finalTarget)
        : new THREE.Vector3(xSpan / 2, ySpan / 2, zSpan / 2).length()

    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const aspect = Math.max(viewportWidth / Math.max(viewportHeight, 1), 0.2)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
    const limitingHalfFov = Math.max(Math.min(verticalFov, horizontalFov) / 2, 0.2)
    const fitDistance = radius / Math.sin(limitingHalfFov)

    const fitPadding = isAreaFocus ? VIEWPORT_PADDING + 86 : VIEWPORT_PADDING
    const finalDistance = clamp(fitDistance * (isAreaFocus ? 1.32 : 1.12) + fitPadding, 120, 1050)
    const finalPos = finalTarget.clone().addScaledVector(preferredDirection, finalDistance)

    const travel = finalPos.clone().sub(startPos)
    const bend = new THREE.Vector3().crossVectors(travel, new THREE.Vector3(0, 1, 0))
    if (bend.lengthSq() < 0.001) bend.set(0.6, 0.1, 0.4)
    bend.normalize().multiplyScalar(Math.max(18, span * 0.08))

    const cameraControl = startPos
      .clone()
      .lerp(finalPos, 0.52)
      .add(bend)
      .add(new THREE.Vector3(0, Math.max(10, span * 0.05), 0))

    const targetControl = currentTarget
      .clone()
      .lerp(finalTarget, 0.5)
      .add(bend.clone().multiplyScalar(0.32))

    animationRef.current = {
      startAt: performance.now(),
      duration: 2350,
      cameraCurve: new THREE.QuadraticBezierCurve3(startPos, cameraControl, finalPos),
      targetCurve: new THREE.QuadraticBezierCurve3(currentTarget, targetControl, finalTarget),
    }
  }, [camera, controlsRef, focusRequest, graphData, viewportWidth, viewportHeight])

  const handleNodeHover = (node) => {
    const hoverId = node?.id ?? null
    if (lastHoverIdRef.current === hoverId) return
    lastHoverIdRef.current = hoverId

    const nextNodes = new Set()
    const nextLinks = new Set()

    if (node) {
      nextNodes.add(node)
      node.neighbors?.forEach((neighbor) => nextNodes.add(neighbor))
      node.linkedBy?.forEach((link) => nextLinks.add(link))
    }

    setHoverNode(node)
    setHighlightNodes(nextNodes)
    setHighlightLinks(nextLinks)
    onNodeHover?.(node)
    if (detailTrigger === 'hover') {
      onDetailNodeChange?.(node ?? null)
    }
  }

  const handleNodeClick = (node, event) => {
    onNodeClick?.(node, event)
    if (detailTrigger === 'click') {
      onDetailNodeChange?.(node ?? null)
    }
  }

  const hideInactive = quality.hideInactive && activeNodeIdSet.size > 0

  return (
    <>
      <R3fForceGraph
        ref={fgRef}
        graphData={graphData}
        enablePointerInteraction
        nodeResolution={quality.nodeResolution}
        linkResolution={quality.linkResolution}
        cooldownTicks={effectiveCooldownTicks}
        cooldownTime={effectiveCooldownTime}
        d3VelocityDecay={isDense ? 0.62 : 0.48}
        d3AlphaDecay={isDense ? 0.09 : 0.045}
        nodeVal={(node) => node.val}
        nodeVisibility={(node) => !hideInactive || activeNodeIdSet.has(node.id)}
        nodeColor={(node) => {
          if (hoverNode && node === hoverNode) return '#ffffff'
          if (highlightNodes.size > 0 && highlightNodes.has(node)) return '#ffe082'
          if (activeNodeIdSet.size > 0 && activeNodeIdSet.has(node.id)) return node.__displayColor
          if (activeNodeIdSet.size > 0 && dimInactive) return 'rgba(109, 120, 157, 0.42)'
          return node.__displayColor
        }}
        nodeOpacity={activeNodeIdSet.size > 0 ? 0.9 : 0.96}
        linkVisibility={(link) =>
          !hideInactive ||
          (activeNodeIdSet.has(link.source.id ?? link.source) &&
            activeNodeIdSet.has(link.target.id ?? link.target))
        }
        linkWidth={(link) => {
          if (highlightLinks.has(link)) return 4
          if (
            activeNodeIdSet.size > 0 &&
            activeNodeIdSet.has(link.source.id ?? link.source) &&
            activeNodeIdSet.has(link.target.id ?? link.target)
          ) {
            return 1.1 + (link.strength ?? 1) * 0.3
          }
          if (activeNodeIdSet.size > 0 && dimInactive) return 0.25
          return 0.7 + (link.strength ?? 1) * 0.28
        }}
        linkColor={(link) => {
          if (highlightLinks.has(link)) return '#fff2a8'
          if (
            activeNodeIdSet.size > 0 &&
            activeNodeIdSet.has(link.source.id ?? link.source) &&
            activeNodeIdSet.has(link.target.id ?? link.target)
          ) {
            return 'rgba(175, 194, 255, 0.74)'
          }
          if (activeNodeIdSet.size > 0 && dimInactive) return 'rgba(76, 86, 124, 0.2)'
          return link.color ?? 'rgba(111, 127, 220, 0.48)'
        }}
        linkOpacity={activeNodeIdSet.size > 0 ? 0.55 : 0.62}
        linkDirectionalParticles={(link) =>
          highlightLinks.has(link)
            ? effectiveParticleHighlight
            : effectiveParticleIdle
        }
        linkDirectionalParticleSpeed={0.008}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(link) =>
          highlightLinks.has(link) ? '#fff2a8' : 'rgba(170, 184, 255, 0.78)'
        }
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />
    </>
  )
}

function GraphScene({
  graphData,
  focusRequest,
  activeNodeIds,
  quality,
  viewStateRef,
  camera,
  background,
  fog,
  detailTrigger,
  onDetailNodeChange,
  dimInactive,
  onNodeClick,
  onNodeHover,
}) {
  const controlsRef = useRef(null)

  return (
    <Canvas
      dpr={quality.dpr}
      gl={{ antialias: quality.antialias, powerPreference: 'low-power' }}
      camera={{
        position: camera.position ?? [220, 100, 300],
        fov: camera.fov ?? 52,
        near: camera.near ?? 0.1,
        far: camera.far ?? 4500,
      }}
    >
      <color attach="background" args={[background]} />
      {fog && <fog attach="fog" args={[background, fog.near ?? 280, fog.far ?? 1800]} />}
      <ambientLight intensity={0.95} />
      <directionalLight position={[120, 140, 80]} intensity={2.2} color="#f6f8ff" />
      <directionalLight position={[-100, -90, -120]} intensity={1.3} color="#7bc4ff" />
      {quality.sparklesCount > 0 && (
        <Sparkles
          size={quality.sparklesSize}
          scale={[1000, 650, 1000]}
          count={quality.sparklesCount}
          speed={0.25}
          color="#81a8ff"
        />
      )}
      <GraphLayer
        graphData={graphData}
        focusRequest={focusRequest}
        controlsRef={controlsRef}
        activeNodeIds={activeNodeIds}
        quality={quality}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        detailTrigger={detailTrigger}
        onDetailNodeChange={onDetailNodeChange}
        dimInactive={dimInactive}
      />
      <SceneTelemetry controlsRef={controlsRef} viewStateRef={viewStateRef} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.72}
        minDistance={camera.minDistance ?? 60}
        maxDistance={camera.maxDistance ?? 1500}
      />
    </Canvas>
  )
}

function normalizeData(data) {
  const nodes = (data?.nodes ?? []).map((node) => ({
    ...node,
    neighbors: [],
    linkedBy: [],
  }))

  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const links = (data?.links ?? [])
    .filter((link) => nodeById.has(link.source) || nodeById.has(link.source?.id))
    .filter((link) => nodeById.has(link.target) || nodeById.has(link.target?.id))
    .map((link, index) => ({
      ...link,
      id: link.id ?? `link-${index}`,
      source: link.source?.id ?? link.source,
      target: link.target?.id ?? link.target,
      color: link.color ?? 'rgba(111, 127, 220, 0.48)',
    }))

  links.forEach((link) => {
    const source = nodeById.get(link.source)
    const target = nodeById.get(link.target)
    if (!source || !target) return
    source.neighbors.push(target)
    target.neighbors.push(source)
    source.linkedBy.push(link)
    target.linkedBy.push(link)
  })

  return { nodes, links }
}

function buildTeamColorMap(nodes, teamKey, teamColors) {
  const map = new Map()
  nodes.forEach((node) => {
    const teamId = node[teamKey]
    if (!teamId || map.has(teamId)) return
    map.set(teamId, teamColors?.[teamId] ?? TEAM_PALETTE[hashString(teamId) % TEAM_PALETTE.length])
  })
  return map
}

function scopeData(rawData, teamScope, hiddenTeamIds, showCrossTeamLinks, teamKey) {
  const hidden = new Set(hiddenTeamIds ?? [])
  const scopedTeams = teamScope ? new Set(teamScope) : null

  const nodes = (rawData?.nodes ?? []).filter((node) => {
    const teamId = node[teamKey]
    if (hidden.has(teamId)) return false
    if (!scopedTeams) return true
    return scopedTeams.has(teamId)
  })

  const nodeIdSet = new Set(nodes.map((node) => node.id))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const links = (rawData?.links ?? []).filter((link) => {
    const sourceId = link.source?.id ?? link.source
    const targetId = link.target?.id ?? link.target
    if (!nodeIdSet.has(sourceId) || !nodeIdSet.has(targetId)) return false
    if (showCrossTeamLinks) return true
    const sourceTeam = nodeById.get(sourceId)?.[teamKey]
    const targetTeam = nodeById.get(targetId)?.[teamKey]
    return sourceTeam === targetTeam
  })

  return { nodes, links }
}

function scopeDataByUser(rawData, userScope, hiddenUserIds, userKey) {
  const hidden = new Set(hiddenUserIds ?? [])
  const scopedUsers = userScope ? new Set(userScope) : null

  const nodes = (rawData?.nodes ?? []).filter((node) => {
    const userId = node[userKey]
    if (hidden.has(userId)) return false
    if (!scopedUsers) return true
    return scopedUsers.has(userId)
  })

  const nodeIdSet = new Set(nodes.map((node) => node.id))
  const links = (rawData?.links ?? []).filter((link) => {
    const sourceId = link.source?.id ?? link.source
    const targetId = link.target?.id ?? link.target
    return nodeIdSet.has(sourceId) && nodeIdSet.has(targetId)
  })

  return { nodes, links }
}

export const KnowledgeGraph = forwardRef(function KnowledgeGraph(
  {
    data,
    groups = EMPTY_ARRAY,
    teamKey = 'teamId',
    documentKey = 'documentId',
    userKey = 'uploadedByUserId',
    userDisplayNameKey = 'uploadedByName',
    userProfiles = EMPTY_OBJECT,
    teamColors = EMPTY_OBJECT,
    initialTeamScope = null,
    initialUserScope = null,
    hiddenTeamIds = EMPTY_ARRAY,
    hiddenUserIds = EMPTY_ARRAY,
    showCrossTeamLinks = true,
    className,
    style,
    qualityMode = DEFAULT_QUALITY_MODE,
    background = '#07122e',
    fog = { near: 280, far: 1800 },
    camera = EMPTY_OBJECT,
    autoFocusOnNodeClick = true,
    dimInactive = true,
    detailTrigger = 'click',
    showDetailPanel = true,
    detailPanelPlacement = 'middle-right',
    detailPanelOffset = EMPTY_OBJECT,
    detailRenderer,
    initialFocus = DEFAULT_INITIAL_FOCUS,
    onNodeClick,
    onNodeHover,
    onFocusChange,
  },
  ref,
) {
  const [rawData, setRawData] = useState(data)
  const viewStateRef = useRef(null)
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const [teamScope, setTeamScope] = useState(initialTeamScope)
  const [userScope, setUserScope] = useState(initialUserScope)

  useEffect(() => {
    setRawData(data)
  }, [data])

  useEffect(() => {
    setTeamScope(initialTeamScope)
  }, [initialTeamScope])

  useEffect(() => {
    setUserScope(initialUserScope)
  }, [initialUserScope])

  const teamScopedData = useMemo(
    () => scopeData(rawData, teamScope, hiddenTeamIds, showCrossTeamLinks, teamKey),
    [rawData, teamScope, hiddenTeamIds, showCrossTeamLinks, teamKey],
  )

  const filteredData = useMemo(
    () => scopeDataByUser(teamScopedData, userScope, hiddenUserIds, userKey),
    [teamScopedData, userScope, hiddenUserIds, userKey],
  )

  const teamColorMap = useMemo(
    () => buildTeamColorMap(filteredData.nodes, teamKey, teamColors),
    [filteredData.nodes, teamKey, teamColors],
  )

  const graphData = useMemo(() => {
    const normalized = normalizeData(filteredData)
    normalized.nodes.forEach((node) => {
      const teamId = node[teamKey]
      node.__displayColor = node.color ?? teamColorMap.get(teamId) ?? '#8ad4ff'
      node.__uploaderName =
        node[userDisplayNameKey] ??
        userProfiles?.[node[userKey]]?.name ??
        userProfiles?.[node[userKey]]?.displayName ??
        node[userKey] ??
        'unknown-user'
    })
    return normalized
  }, [filteredData, teamKey, teamColorMap, userDisplayNameKey, userProfiles, userKey])

  const [qualityState, setQualityState] = useState(qualityMode)
  const [activeNodeIds, setActiveNodeIds] = useState([])
  const [detailNode, setDetailNode] = useState(null)
  const [focusRequest, setFocusRequest] = useState({
    nodeIds: graphData.nodes.map((node) => node.id),
    kind: 'default',
    key: 0,
  })

  useEffect(() => {
    setQualityState(qualityMode)
  }, [qualityMode])

  const knownNodeIds = useMemo(() => new Set(graphData.nodes.map((node) => node.id)), [graphData.nodes])
  const quality = QUALITY_PRESETS[qualityState] ?? QUALITY_PRESETS[DEFAULT_QUALITY_MODE]

  const normalizeNodeIds = useCallback(
    (nodeIds) => [...new Set(nodeIds)].filter((nodeId) => knownNodeIds.has(nodeId)),
    [knownNodeIds],
  )

  const focusOnNodes = useCallback(
    (nodeIds, kind = 'default') => {
      const sanitizedNodeIds = normalizeNodeIds(nodeIds)
      if (!sanitizedNodeIds.length) return
      setActiveNodeIds(sanitizedNodeIds)
      setFocusRequest((prev) => ({
        nodeIds: sanitizedNodeIds,
        kind,
        key: prev.key + 1,
      }))
      onFocusChange?.({ type: kind, nodeIds: sanitizedNodeIds })
    },
    [normalizeNodeIds, onFocusChange],
  )

  const focusAll = useCallback(() => {
    const allIds = graphData.nodes.map((node) => node.id)
    focusOnNodes(allIds, 'all')
  }, [focusOnNodes, graphData.nodes])

  const focusGroup = useCallback(
    (groupId) => {
      const group = groupsById.get(groupId)
      if (!group) return false
      focusOnNodes(group.nodeIds, 'area')
      return true
    },
    [groupsById, focusOnNodes],
  )

  useEffect(() => {
    if (!graphData.nodes.length) return

    if (initialFocus.type === 'group' && initialFocus.groupId) {
      if (focusGroup(initialFocus.groupId)) return
    }

    if (initialFocus.type === 'nodes' && Array.isArray(initialFocus.nodeIds)) {
      focusOnNodes(initialFocus.nodeIds, 'default')
      return
    }

    focusAll()
  }, [
    focusAll,
    focusGroup,
    focusOnNodes,
    initialFocus.groupId,
    initialFocus.type,
    initialFocus.nodeIds,
    graphData.nodes.length,
  ])

  const focusTeam = useCallback(
    (teamId) => {
      const ids = graphData.nodes.filter((node) => node[teamKey] === teamId).map((node) => node.id)
      if (!ids.length) return false
      focusOnNodes(ids, 'area')
      return true
    },
    [focusOnNodes, graphData.nodes, teamKey],
  )

  const focusDocument = useCallback(
    (documentId) => {
      const ids = graphData.nodes
        .filter((node) => String(node[documentKey]) === String(documentId))
        .map((node) => node.id)
      if (!ids.length) return false
      focusOnNodes(ids, 'default')
      return true
    },
    [focusOnNodes, graphData.nodes, documentKey],
  )

  const focusUser = useCallback(
    (userId) => {
      const ids = graphData.nodes
        .filter((node) => String(node[userKey]) === String(userId))
        .map((node) => node.id)
      if (!ids.length) return false
      focusOnNodes(ids, 'area')
      return true
    },
    [focusOnNodes, graphData.nodes, userKey],
  )

  const search = useCallback(
    (query, { limit = 25, focus = false } = {}) => {
      const normalized = String(query ?? '').trim().toLowerCase()
      if (!normalized) return []
      const results = graphData.nodes.filter((node) => {
        const blob = [
          node.label,
          node.category,
          node.summary,
          node[teamKey],
          node[documentKey],
          node[userKey],
          node.__uploaderName,
          ...(node.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return blob.includes(normalized)
      })
      const sliced = results.slice(0, limit)
      if (focus && sliced.length) {
        focusOnNodes(sliced.map((node) => node.id), 'search')
      }
      return sliced
    },
    [documentKey, focusOnNodes, graphData.nodes, teamKey, userKey],
  )

  useImperativeHandle(
    ref,
    () => ({
      focusAll,
      focusNodes: (nodeIds) => focusOnNodes(nodeIds, 'default'),
      focusGroup,
      focusTeam,
      focusDocument,
      focusUser,
      search,
      setTeamScope: (teamIds, { focus = true } = {}) => {
        setTeamScope(teamIds?.length ? [...new Set(teamIds)] : null)
        if (focus && teamIds?.length) {
          const ids = graphData.nodes
            .filter((node) => teamIds.includes(node[teamKey]))
            .map((node) => node.id)
          if (ids.length) focusOnNodes(ids, 'area')
        }
      },
      clearTeamScope: ({ focus = true } = {}) => {
        setTeamScope(null)
        if (focus) focusAll()
      },
      setUserScope: (userIds, { focus = true } = {}) => {
        setUserScope(userIds?.length ? [...new Set(userIds)] : null)
        if (focus && userIds?.length) {
          const ids = graphData.nodes
            .filter((node) => userIds.includes(node[userKey]))
            .map((node) => node.id)
          if (ids.length) focusOnNodes(ids, 'area')
        }
      },
      clearUserScope: ({ focus = true } = {}) => {
        setUserScope(null)
        if (focus) focusAll()
      },
      upsertData: (patch) => {
        setRawData((prev) => mergeGraphData(prev, patch))
      },
      setQuality: (mode) => {
        if (QUALITY_PRESETS[mode]) {
          setQualityState(mode)
          return true
        }
        return false
      },
      getSnapshot: () => {
        const view = viewStateRef.current
        return {
          quality: qualityState,
          teamScope,
          userScope,
          activeNodeIds,
          focusNodeIds: focusRequest.nodeIds,
          view,
        }
      },
      listTeams: () => [...new Set(graphData.nodes.map((node) => node[teamKey]).filter(Boolean))],
      listDocuments: () =>
        [...new Set(graphData.nodes.map((node) => node[documentKey]).filter(Boolean))],
      listUsers: () => [...new Set(graphData.nodes.map((node) => node[userKey]).filter(Boolean))],
    }),
    [
      activeNodeIds,
      documentKey,
      focusAll,
      focusDocument,
      focusGroup,
      focusOnNodes,
      focusRequest.nodeIds,
      focusTeam,
      focusUser,
      graphData.nodes,
      qualityState,
      search,
      teamKey,
      teamScope,
      userKey,
      userScope,
    ],
  )

  const handleNodeClick = useCallback(
    (node, event) => {
      onNodeClick?.(node, event)
      if (autoFocusOnNodeClick && node) {
        const relatedNodeIds = [node.id, ...(node.neighbors ?? []).map((neighbor) => neighbor.id)]
        focusOnNodes(relatedNodeIds, 'node')
      }
    },
    [autoFocusOnNodeClick, onNodeClick, focusOnNodes],
  )

  const detailPanelPositionStyle = useMemo(() => {
    const offsetX = detailPanelOffset?.x ?? 0
    const offsetY = detailPanelOffset?.y ?? 0

    switch (detailPanelPlacement) {
      case 'top-right':
        return { right: `${20 + offsetX}px`, top: `${20 + offsetY}px` }
      case 'bottom-right':
        return { right: `${20 + offsetX}px`, bottom: `${20 + offsetY}px` }
      case 'middle-right':
      default:
        return {
          right: `${20 + offsetX}px`,
          top: `calc(50% + ${offsetY}px)`,
          transform: 'translateY(-50%)',
        }
    }
  }, [detailPanelOffset, detailPanelPlacement])

  const defaultDetailPanel = useCallback(
    (node) => (
      <div
        style={{
          width: '290px',
          maxWidth: '42vw',
          borderRadius: '10px',
          border: '1px solid rgba(178, 198, 255, 0.5)',
          background: 'rgba(7, 16, 44, 0.94)',
          color: '#edf2ff',
          padding: '0.52rem 0.64rem',
          boxShadow: '0 10px 24px rgba(3, 8, 26, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
          backdropFilter: 'blur(8px)',
        }}
      >
        <strong style={{ fontSize: '0.9rem', lineHeight: 1.2 }}>{node.label}</strong>
        <span style={{ color: '#bfd0ff', fontSize: '0.74rem', lineHeight: 1.2 }}>
          {node[teamKey] ?? 'no-team'} · {node[documentKey] ?? 'no-doc'}
        </span>
        <span style={{ color: '#bdd6ff', fontSize: '0.72rem', lineHeight: 1.2 }}>
          uploaded by {node.__uploaderName}
        </span>
        <span style={{ color: '#9db0e9', fontSize: '0.71rem', lineHeight: 1.2 }}>
          {node.category ?? 'Uncategorized'}
        </span>
        <p style={{ margin: 0, color: '#d7e3ff', fontSize: '0.76rem', lineHeight: 1.32 }}>
          {node.summary ?? 'No summary available.'}
        </p>
      </div>
    ),
    [documentKey, teamKey],
  )

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      <GraphScene
        graphData={graphData}
        focusRequest={focusRequest}
        activeNodeIds={activeNodeIds}
        quality={quality}
        viewStateRef={viewStateRef}
        camera={camera}
        background={background}
        fog={fog}
        detailTrigger={detailTrigger}
        onDetailNodeChange={setDetailNode}
        dimInactive={dimInactive}
        onNodeClick={handleNodeClick}
        onNodeHover={onNodeHover}
      />
      {showDetailPanel && detailNode && (
        <div style={{ position: 'absolute', zIndex: 30, pointerEvents: 'none', ...detailPanelPositionStyle }}>
          {detailRenderer ? detailRenderer(detailNode) : defaultDetailPanel(detailNode)}
        </div>
      )}
    </div>
  )
})
