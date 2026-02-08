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
import { Html, OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import R3fForceGraph from 'r3f-forcegraph'
import { DEFAULT_QUALITY_MODE, QUALITY_PRESETS } from './qualityPresets'

const VIEWPORT_PADDING = 48

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
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
  hoverTooltip,
  tooltipRenderer,
  dimInactive,
}) {
  const fgRef = useRef(null)
  const animationRef = useRef(null)
  const { camera, size } = useThree()
  const viewportWidth = size.width
  const viewportHeight = size.height
  const [hoverNode, setHoverNode] = useState(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const activeNodeIdSet = useMemo(() => new Set(activeNodeIds), [activeNodeIds])

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
  }, [quality])

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
  }

  const handleNodeClick = (node, event) => {
    onNodeClick?.(node, event)
  }

  const showHoverPopover =
    hoverTooltip &&
    hoverNode &&
    Number.isFinite(hoverNode.x) &&
    Number.isFinite(hoverNode.y) &&
    Number.isFinite(hoverNode.z) &&
    (activeNodeIdSet.size === 0 || activeNodeIdSet.has(hoverNode.id))

  const hideInactive = quality.hideInactive && activeNodeIdSet.size > 0

  return (
    <>
      <R3fForceGraph
        ref={fgRef}
        graphData={graphData}
        nodeResolution={quality.nodeResolution}
        linkResolution={quality.linkResolution}
        cooldownTicks={quality.cooldownTicks}
        cooldownTime={quality.cooldownTime}
        nodeVal={(node) => node.val}
        nodeVisibility={(node) => !hideInactive || activeNodeIdSet.has(node.id)}
        nodeColor={(node) => {
          if (hoverNode && node === hoverNode) return '#ffffff'
          if (highlightNodes.size > 0 && highlightNodes.has(node)) return '#ffe082'
          if (activeNodeIdSet.size > 0 && activeNodeIdSet.has(node.id)) return node.color ?? '#8ad4ff'
          if (activeNodeIdSet.size > 0 && dimInactive) return 'rgba(109, 120, 157, 0.42)'
          return node.color ?? '#8ad4ff'
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
            ? quality.directionalParticlesHighlight
            : quality.directionalParticlesIdle
        }
        linkDirectionalParticleSpeed={0.008}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(link) =>
          highlightLinks.has(link) ? '#fff2a8' : 'rgba(170, 184, 255, 0.78)'
        }
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />
      {showHoverPopover && (
        <Html
          position={[
            hoverNode.x,
            hoverNode.y + Math.max(8, Math.cbrt(Math.max(hoverNode.val ?? 1, 1)) * 5),
            hoverNode.z,
          ]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          {tooltipRenderer ? (
            tooltipRenderer(hoverNode)
          ) : (
            <div
              style={{
                minWidth: '140px',
                borderRadius: '10px',
                border: '1px solid rgba(178, 198, 255, 0.48)',
                background: 'rgba(7, 16, 44, 0.9)',
                color: '#edf2ff',
                padding: '0.36rem 0.5rem',
                boxShadow: '0 10px 24px rgba(3, 8, 26, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.08rem',
                backdropFilter: 'blur(8px)',
                fontFamily: 'sans-serif',
              }}
            >
              <strong style={{ fontSize: '0.74rem', lineHeight: 1.15 }}>{hoverNode.label}</strong>
              <span style={{ color: '#bfd0ff', fontSize: '0.64rem', lineHeight: 1.1 }}>
                {hoverNode.category}
              </span>
            </div>
          )}
        </Html>
      )}
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
  hoverTooltip,
  tooltipRenderer,
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
        hoverTooltip={hoverTooltip}
        tooltipRenderer={tooltipRenderer}
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

export const KnowledgeGraph = forwardRef(function KnowledgeGraph(
  {
    data,
    groups = [],
    className,
    style,
    qualityMode = DEFAULT_QUALITY_MODE,
    background = '#07122e',
    fog = { near: 280, far: 1800 },
    camera = {},
    autoFocusOnNodeClick = true,
    dimInactive = true,
    hoverTooltip = true,
    tooltipRenderer,
    initialFocus = { type: 'all' },
    onNodeClick,
    onNodeHover,
    onFocusChange,
  },
  ref,
) {
  const graphData = useMemo(() => normalizeData(data), [data])
  const viewStateRef = useRef(null)
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])

  const [qualityState, setQualityState] = useState(qualityMode)
  const [activeNodeIds, setActiveNodeIds] = useState([])
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
  }, [focusAll, focusGroup, focusOnNodes, initialFocus, graphData.nodes.length])

  useImperativeHandle(
    ref,
    () => ({
      focusAll,
      focusNodes: (nodeIds) => focusOnNodes(nodeIds, 'default'),
      focusGroup,
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
          activeNodeIds,
          focusNodeIds: focusRequest.nodeIds,
          view,
        }
      },
    }),
    [focusAll, focusOnNodes, focusGroup, qualityState, activeNodeIds, focusRequest.nodeIds],
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
        hoverTooltip={hoverTooltip}
        tooltipRenderer={tooltipRenderer}
        dimInactive={dimInactive}
        onNodeClick={handleNodeClick}
        onNodeHover={onNodeHover}
      />
    </div>
  )
})
