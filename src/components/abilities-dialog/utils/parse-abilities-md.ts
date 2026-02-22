import type {
  Heading,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
} from 'mdast'

export type AbilityEntry = {
  name: string
  type?: string
  description?: string[]
  done: boolean
}

export type Subsection = {
  title: string
  abilities: AbilityEntry[]
}

export type Section = {
  title: string
  subsections?: Subsection[]
  abilities?: AbilityEntry[]
}

function textContent(nodes: PhrasingContent[]): string {
  return nodes
    .map(n =>
      'value' in n
        ? n.value
        : textContent((n as { children: PhrasingContent[] }).children),
    )
    .join('')
}

function headingText(node: Heading): string {
  return textContent(node.children)
}

function parseListItem(item: ListItem): AbilityEntry | null {
  const done = item.checked === true
  const paragraph = item.children.find(c => c.type === 'paragraph')
  if (!paragraph) return null

  const children = paragraph.children
  const strong = children.find(c => c.type === 'strong')

  if (!strong) {
    return { name: textContent(children).trim(), done }
  }

  const name = textContent(strong.children)
  const strongIdx = children.indexOf(strong)
  let rest = textContent(children.slice(strongIdx + 1)).trim()

  let type: string | undefined
  const parenMatch = rest.match(/^\((.+?)\)\s*(.*)$/)
  if (parenMatch) {
    type = parenMatch[1]
    rest = parenMatch[2].trim()
  }

  let description: string[] | undefined
  const descMatch = rest.match(/^[—-]\s*(.+)$/)
  if (descMatch) {
    const raw = descMatch[1]
    const colonIdx = raw.indexOf(':')
    description =
      colonIdx === -1
        ? [raw]
        : [raw.slice(0, colonIdx + 1), raw.slice(colonIdx + 1).trim()]
  }

  return { name, type, description, done }
}

export function parseAbilitiesMd(tree: Root): Section[] {
  const sections: Section[] = []
  let currentSection: Section | null = null
  let currentSubsection: Subsection | null = null

  function flushSubsection() {
    if (currentSubsection && currentSection?.subsections) {
      currentSection.subsections.push(currentSubsection)
      currentSubsection = null
    }
  }

  function addAbility(entry: AbilityEntry) {
    if (currentSubsection) {
      currentSubsection.abilities.push(entry)
    } else if (currentSection) {
      if (!currentSection.abilities) currentSection.abilities = []
      currentSection.abilities.push(entry)
    }
  }

  for (const node of tree.children as RootContent[]) {
    if (node.type === 'heading' && node.depth === 2) {
      flushSubsection()
      currentSection = { title: headingText(node) }
      sections.push(currentSection)
      continue
    }

    if (node.type === 'heading' && node.depth === 3) {
      flushSubsection()
      currentSubsection = { title: headingText(node), abilities: [] }
      if (currentSection && !currentSection.subsections) {
        currentSection.subsections = []
      }
      continue
    }

    if (node.type === 'list') {
      for (const item of node.children) {
        const entry = parseListItem(item)
        if (entry) addAbility(entry)
      }
    }
  }

  flushSubsection()
  return sections
}
