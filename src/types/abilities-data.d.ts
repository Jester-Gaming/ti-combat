declare module '*.md' {
  import type { Root } from 'mdast'
  const ast: Root
  export default ast
}
