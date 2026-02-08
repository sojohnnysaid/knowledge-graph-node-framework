const baseNodes = [
  {
    id: 'doc-food-fermentation',
    label: 'Fermentation Atlas',
    category: 'Food Science',
    tags: ['food', 'microbiology', 'tradition'],
    document: 'Doc-001',
    summary: 'Compares kimchi, sourdough, and kefir cultures and their nutrient impact.',
    val: 13,
  },
  {
    id: 'doc-place-seoul',
    label: 'Seoul Street Markets',
    category: 'Places',
    tags: ['place', 'korea', 'night market'],
    document: 'Doc-002',
    summary: 'Maps neighborhoods where fermentation-heavy cuisines shape local commerce.',
    val: 11,
  },
  {
    id: 'doc-climate-rice',
    label: 'Monsoon Rice Patterns',
    category: 'Climate',
    tags: ['agriculture', 'rainfall', 'food security'],
    document: 'Doc-003',
    summary: 'Links rainfall shifts to rice quality and regional supply chains.',
    val: 10,
  },
  {
    id: 'doc-logistics-coldchain',
    label: 'Cold Chain Logistics',
    category: 'Supply Chain',
    tags: ['transport', 'food', 'infrastructure'],
    document: 'Doc-004',
    summary: 'Explains how refrigeration hubs preserve seafood and vaccine products.',
    val: 9,
  },
  {
    id: 'doc-food-desert',
    label: 'Urban Food Deserts',
    category: 'Public Health',
    tags: ['equity', 'food access', 'cities'],
    document: 'Doc-005',
    summary: 'Analyzes neighborhoods where transit access predicts fresh food availability.',
    val: 12,
  },
  {
    id: 'doc-place-lima',
    label: 'Lima Coastal Kitchens',
    category: 'Places',
    tags: ['place', 'peru', 'seafood'],
    document: 'Doc-006',
    summary: 'Shows how ocean currents influence local cuisine and seasonal menus.',
    val: 10,
  },
  {
    id: 'topic-canada',
    label: 'Canada Federal Mosaic',
    category: 'Geography',
    tags: ['canada', 'policy', 'culture'],
    document: 'Doc-007',
    summary: 'Profiles provinces, bilingual governance, and migration-linked food systems.',
    val: 13,
  },
  {
    id: 'topic-wwii',
    label: 'WWII Strategic Timeline',
    category: 'History',
    tags: ['wwii', 'allies', 'global conflict'],
    document: 'Doc-008',
    summary: 'Chronicles key campaigns, industrial shifts, and postwar rebuilding patterns.',
    val: 14,
  },
  {
    id: 'topic-new-zealand',
    label: 'New Zealand Island Systems',
    category: 'Geography',
    tags: ['new zealand', 'pacific', 'conservation'],
    document: 'Doc-009',
    summary: 'Connects Maori heritage, biodiversity stewardship, and tourism dynamics.',
    val: 12,
  },
  {
    id: 'topic-forrest-gump',
    label: 'Forrest Gump Cultural Echo',
    category: 'Film',
    tags: ['forrest gump', 'cinema', 'american history'],
    document: 'Doc-010',
    summary: 'Maps narrative touchpoints to major U.S. social moments and memory politics.',
    val: 11,
  },
  {
    id: 'topic-sixties-pop',
    label: '1960s Pop Music Culture',
    category: 'Music',
    tags: ['1960s', 'pop music', 'counterculture'],
    document: 'Doc-011',
    summary: 'Traces radio, youth identity, and recording technology through the decade.',
    val: 12,
  },
  {
    id: 'topic-foo-fighters',
    label: 'Foo Fighters Discography Arc',
    category: 'Music',
    tags: ['foo fighters', 'rock', 'band evolution'],
    document: 'Doc-012',
    summary: 'Examines lineup changes, studio experimentation, and stadium-era sound.',
    val: 10,
  },
  {
    id: 'topic-shakespeare',
    label: 'Shakespeare Performance Network',
    category: 'Literature',
    tags: ['shakespeare', 'theatre', 'language'],
    document: 'Doc-013',
    summary: 'Links tragedies and comedies with modern adaptations and classroom canon.',
    val: 13,
  },
  {
    id: 'doc-tourism-flavor',
    label: 'Flavor Tourism Trends',
    category: 'Economics',
    tags: ['travel', 'food', 'economy'],
    document: 'Doc-014',
    summary: 'Shows visitors choose destinations based on distinctive food identities.',
    val: 9,
  },
  {
    id: 'doc-health-probiotics',
    label: 'Probiotic Health Outcomes',
    category: 'Public Health',
    tags: ['health', 'microbiome', 'food science'],
    document: 'Doc-015',
    summary: 'Connects fermented diets to reduced inflammation indicators.',
    val: 11,
  },
  {
    id: 'doc-energy-kitchens',
    label: 'Low-Carbon Kitchens',
    category: 'Sustainability',
    tags: ['energy', 'cooking', 'climate'],
    document: 'Doc-016',
    summary: 'Benchmarks induction, biogas, and electric fleet transitions.',
    val: 8,
  },
]

const baseLinks = [
  { source: 'doc-food-fermentation', target: 'doc-place-seoul', relation: 'origin-story', strength: 3 },
  { source: 'doc-food-fermentation', target: 'doc-health-probiotics', relation: 'supports', strength: 3 },
  { source: 'doc-place-seoul', target: 'doc-tourism-flavor', relation: 'attracts', strength: 2 },
  { source: 'doc-place-lima', target: 'doc-climate-rice', relation: 'climate parity', strength: 1 },
  { source: 'doc-place-lima', target: 'doc-tourism-flavor', relation: 'destination demand', strength: 3 },
  { source: 'doc-place-lima', target: 'doc-logistics-coldchain', relation: 'seafood transport', strength: 2 },
  { source: 'doc-logistics-coldchain', target: 'doc-food-desert', relation: 'distribution gap', strength: 2 },
  { source: 'doc-food-desert', target: 'doc-health-probiotics', relation: 'nutrition impact', strength: 2 },
  { source: 'doc-climate-rice', target: 'doc-energy-kitchens', relation: 'mitigation loop', strength: 2 },
  { source: 'topic-canada', target: 'doc-food-desert', relation: 'urban policy overlap', strength: 2 },
  { source: 'topic-new-zealand', target: 'doc-energy-kitchens', relation: 'decarbonization pilots', strength: 2 },
  { source: 'topic-wwii', target: 'topic-shakespeare', relation: 'wartime productions', strength: 1 },
  { source: 'topic-sixties-pop', target: 'topic-forrest-gump', relation: 'soundtrack memory', strength: 2 },
  { source: 'topic-sixties-pop', target: 'topic-foo-fighters', relation: 'rock lineage', strength: 1 },
  { source: 'topic-shakespeare', target: 'topic-forrest-gump', relation: 'narrative archetypes', strength: 1 },
  { source: 'topic-canada', target: 'topic-wwii', relation: 'military history', strength: 2 },
  { source: 'topic-new-zealand', target: 'topic-wwii', relation: 'pacific operations', strength: 2 },
  { source: 'topic-canada', target: 'topic-new-zealand', relation: 'commonwealth channels', strength: 1 },
]

const topicSpecs = [
  {
    id: 'topic-canada',
    short: 'Canada',
    category: 'Geography',
    tags: ['canada', 'federalism', 'north america'],
  },
  {
    id: 'topic-wwii',
    short: 'WWII',
    category: 'History',
    tags: ['wwii', 'archives', 'timeline'],
  },
  {
    id: 'topic-new-zealand',
    short: 'New Zealand',
    category: 'Geography',
    tags: ['new zealand', 'pacific', 'islands'],
  },
  {
    id: 'topic-forrest-gump',
    short: 'Forrest Gump',
    category: 'Film',
    tags: ['forrest gump', 'film studies', 'cinema'],
  },
  {
    id: 'topic-sixties-pop',
    short: '1960s Pop',
    category: 'Music',
    tags: ['1960s', 'pop', 'recording'],
  },
  {
    id: 'topic-foo-fighters',
    short: 'Foo Fighters',
    category: 'Music',
    tags: ['foo fighters', 'alternative rock', 'live music'],
  },
  {
    id: 'topic-shakespeare',
    short: 'Shakespeare',
    category: 'Literature',
    tags: ['shakespeare', 'plays', 'theatre'],
  },
  {
    id: 'doc-food-fermentation',
    short: 'Fermentation',
    category: 'Food Science',
    tags: ['fermentation', 'food science', 'microbes'],
  },
  {
    id: 'doc-logistics-coldchain',
    short: 'Cold Chain',
    category: 'Supply Chain',
    tags: ['logistics', 'cold chain', 'distribution'],
  },
  {
    id: 'doc-climate-rice',
    short: 'Monsoon Rice',
    category: 'Climate',
    tags: ['climate', 'rainfall', 'agriculture'],
  },
]

const facetTemplates = [
  {
    suffix: 'archive',
    label: 'Archive Notes',
    category: 'Archive',
    tags: ['archives', 'sources'],
    relation: 'documents',
    summary: 'Collects annotated source fragments and timeline evidence around',
    val: 6,
  },
  {
    suffix: 'people',
    label: 'People Network',
    category: 'Sociology',
    tags: ['people', 'influence'],
    relation: 'profiles',
    summary: 'Charts people, groups, and influence pathways connected to',
    val: 7,
  },
  {
    suffix: 'places',
    label: 'Geography Layer',
    category: 'Places',
    tags: ['maps', 'regions'],
    relation: 'maps',
    summary: 'Traces geographic anchors, routes, and spatial context for',
    val: 7,
  },
  {
    suffix: 'media',
    label: 'Media Signals',
    category: 'Culture',
    tags: ['media', 'storytelling'],
    relation: 'echoes',
    summary: 'Tracks visual, audio, and publication signals that reshaped understanding of',
    val: 8,
  },
  {
    suffix: 'impact',
    label: 'Impact Assessment',
    category: 'Policy',
    tags: ['impact', 'policy'],
    relation: 'influences',
    summary: 'Measures long-tail effects on institutions, public narratives, and education for',
    val: 8,
  },
]

function createFacetNodes() {
  const nodes = []
  const links = []
  let docId = 17

  topicSpecs.forEach((topic) => {
    let previousFacetId = null

    facetTemplates.forEach((facet, facetIndex) => {
      const facetId = `${topic.id}-${facet.suffix}`
      nodes.push({
        id: facetId,
        label: `${topic.short}: ${facet.label}`,
        category: facet.category,
        tags: [...topic.tags, ...facet.tags],
        document: `Doc-${String(docId).padStart(3, '0')}`,
        summary: `${facet.summary} ${topic.short}.`,
        val: facet.val + (facetIndex % 2),
      })

      links.push({
        source: topic.id,
        target: facetId,
        relation: facet.relation,
        strength: 1 + (facetIndex % 3),
      })

      if (previousFacetId) {
        links.push({
          source: previousFacetId,
          target: facetId,
          relation: 'facet-flow',
          strength: 1,
        })
      }

      previousFacetId = facetId
      docId += 1
    })
  })

  return { nodes, links }
}

function createCrossClusterLinks() {
  return [
    {
      source: 'topic-wwii-archive',
      target: 'topic-canada-people',
      relation: 'veteran migration',
      strength: 2,
    },
    {
      source: 'topic-new-zealand-places',
      target: 'topic-canada-places',
      relation: 'climate comparison',
      strength: 1,
    },
    {
      source: 'topic-forrest-gump-media',
      target: 'topic-sixties-pop-media',
      relation: 'soundtrack parallels',
      strength: 2,
    },
    {
      source: 'topic-sixties-pop-people',
      target: 'topic-foo-fighters-people',
      relation: 'genre lineage',
      strength: 2,
    },
    {
      source: 'topic-shakespeare-media',
      target: 'topic-forrest-gump-impact',
      relation: 'adaptation theory',
      strength: 1,
    },
    {
      source: 'topic-shakespeare-impact',
      target: 'topic-sixties-pop-impact',
      relation: 'education canon',
      strength: 1,
    },
    {
      source: 'doc-food-fermentation-impact',
      target: 'doc-health-probiotics',
      relation: 'nutrition outcomes',
      strength: 2,
    },
    {
      source: 'doc-logistics-coldchain-impact',
      target: 'doc-food-desert',
      relation: 'supply equity',
      strength: 2,
    },
    {
      source: 'doc-climate-rice-impact',
      target: 'topic-new-zealand-impact',
      relation: 'agri policy transfer',
      strength: 1,
    },
    {
      source: 'topic-wwii-impact',
      target: 'topic-shakespeare-archive',
      relation: 'wartime staging records',
      strength: 1,
    },
    {
      source: 'topic-canada-media',
      target: 'topic-foo-fighters-media',
      relation: 'broadcast distribution',
      strength: 1,
    },
    {
      source: 'topic-new-zealand-media',
      target: 'topic-forrest-gump-places',
      relation: 'tourism narratives',
      strength: 1,
    },
  ]
}

const categoryColors = {
  'Food Science': '#ff8a3d',
  Places: '#58b6ff',
  Climate: '#59d19a',
  'Supply Chain': '#ffd166',
  Culture: '#c4a2ff',
  'Public Health': '#ff6e9f',
  Policy: '#7e8bff',
  Technology: '#40e1d0',
  Environment: '#86d26f',
  Economics: '#ffb454',
  Sustainability: '#46c788',
  Geography: '#67c8ff',
  History: '#e6a760',
  Film: '#f58fb9',
  Music: '#b58aff',
  Literature: '#7cd1b6',
  Archive: '#97a4c6',
  Sociology: '#f4b67f',
}

const facetData = createFacetNodes()

const combinedNodes = [...baseNodes, ...facetData.nodes]
const combinedLinks = [...baseLinks, ...facetData.links, ...createCrossClusterLinks()]

export const areasOfInterest = [
  {
    id: 'area-food-systems',
    label: 'Food Systems Cluster',
    description: 'Fermentation, logistics, nutrition, and climate nodes in one lens.',
    focusNodeIds: [
      'doc-food-fermentation',
      'doc-logistics-coldchain',
      'doc-climate-rice',
      'doc-food-desert',
      'doc-health-probiotics',
      'doc-energy-kitchens',
      'doc-food-fermentation-impact',
      'doc-logistics-coldchain-impact',
      'doc-climate-rice-impact',
    ],
  },
  {
    id: 'area-places-history',
    label: 'Canada + NZ + WWII',
    description: 'Geography and war-era records with archival and policy spillover.',
    focusNodeIds: [
      'topic-canada',
      'topic-new-zealand',
      'topic-wwii',
      'topic-canada-archive',
      'topic-new-zealand-places',
      'topic-wwii-impact',
      'topic-wwii-archive',
    ],
  },
  {
    id: 'area-culture-media',
    label: 'Film + Music + Theatre',
    description: 'Forrest Gump, 1960s pop, Foo Fighters, and Shakespeare linkages.',
    focusNodeIds: [
      'topic-forrest-gump',
      'topic-sixties-pop',
      'topic-foo-fighters',
      'topic-shakespeare',
      'topic-forrest-gump-media',
      'topic-sixties-pop-media',
      'topic-foo-fighters-people',
      'topic-shakespeare-impact',
    ],
  },
]

export function buildGraphData() {
  const preparedNodes = combinedNodes.map((node) => ({
    ...node,
    color: categoryColors[node.category] ?? '#8ad4ff',
    neighbors: [],
    linkedBy: [],
  }))

  const nodeById = new Map(preparedNodes.map((node) => [node.id, node]))

  const preparedLinks = combinedLinks
    .filter((link) => nodeById.has(link.source) && nodeById.has(link.target))
    .map((link, index) => ({
      ...link,
      id: `link-${index}`,
      color: 'rgba(111, 127, 220, 0.48)',
    }))

  preparedLinks.forEach((link) => {
    const source = nodeById.get(link.source)
    const target = nodeById.get(link.target)
    if (!source || !target) return

    source.neighbors.push(target)
    target.neighbors.push(source)
    source.linkedBy.push(link)
    target.linkedBy.push(link)
  })

  return { nodes: preparedNodes, links: preparedLinks }
}
