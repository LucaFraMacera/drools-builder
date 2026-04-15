import type {
  AccumulateFunction, AccumulatePattern, AndCondition, Condition,
  Consequence, Constraint, ConstraintOperator, DroolsFile, FactPattern,
  FromCondition, Modification, Rule
} from '../metamodel/types'

// ─── LOW-LEVEL UTILITIES ─────────────────────────────────────────────────────

/**
 * Returns the index of the first occurrence of `needle` in `text` that is
 * at parenthesis/brace/bracket depth 0 and not inside a string literal.
 */
function indexAtDepth0(text: string, needle: string): number {
  let depth = 0
  let inString = false
  let quote = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) inString = false
      continue
    }

    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue }
    if (ch === '(' || ch === '{' || ch === '[') { depth++; continue }
    if (ch === ')' || ch === '}' || ch === ']') { depth--; continue }

    if (depth === 0 && text.startsWith(needle, i)) return i
  }
  return -1
}

/**
 * Splits `text` at all depth-0 occurrences of `separator`.
 * Ignores occurrences inside nested parentheses/braces/brackets and string literals.
 */
function splitAtDepth0(text: string, separator: string): string[] {
  const parts: string[] = []
  const sepLen = separator.length
  let depth = 0
  let inString = false
  let quote = ''
  let current = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (ch === '\\') { current += ch + text[++i]; continue }
      if (ch === quote) inString = false
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") { inString = true; quote = ch; current += ch; continue }
    if (ch === '(' || ch === '{' || ch === '[') { depth++; current += ch; continue }
    if (ch === ')' || ch === '}' || ch === ']') { depth--; current += ch; continue }

    if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(current.trim())
      current = ''
      i += sepLen - 1
      continue
    }

    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(p => p.length > 0)
}

/**
 * Extracts the content between the first matching open/close pair.
 * e.g. extractBalanced("foo(bar(baz))", '(', ')') → "bar(baz)"
 */
function extractBalanced(text: string, open: string, close: string): string {
  const start = text.indexOf(open)
  if (start === -1) return ''
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      depth--
      if (depth === 0) return text.slice(start + 1, i)
    }
  }
  return text.slice(start + 1)
}

/** Strips single-line (//) and block (/* *\/) comments from DRL. */
function stripComments(drl: string): string {
  return drl
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

// ─── FILE-LEVEL PARSING ───────────────────────────────────────────────────────

function parseImports(drl: string): string[] {
  const imports: string[] = []
  const re = /^\s*import\s+([^\s;]+)\s*;?/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(drl)) !== null) imports.push(m[1].trim())
  return imports
}

function extractRuleBlocks(drl: string): string[] {
  const blocks: string[] = []
  const re = /\brule\s+"[^"]*"[\s\S]*?\bend\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(drl)) !== null) blocks.push(m[0])
  return blocks
}

// ─── RULE-LEVEL PARSING ──────────────────────────────────────────────────────

function parseRuleName(block: string): string {
  const m = block.match(/\brule\s+"([^"]+)"/)
  return m ? m[1] : 'unknown'
}

function parseRuleAttributes(block: string): Partial<Rule> {
  const attrs: Partial<Rule> = {}
  const m = block.match(/\brule\s+"[^"]+"\s*([\s\S]*?)\bwhen\b/)
  if (!m) return attrs
  const attr = m[1]
  const salience = attr.match(/\bsalience\s+(-?\d+)/)
  if (salience) attrs.salience = parseInt(salience[1], 10)
  if (/\bno-loop\s+true\b/.test(attr)) attrs.noLoop = true
  if (/\block-on-active\s+true\b/.test(attr)) attrs.lockOnActive = true
  const ag = attr.match(/\bagenda-group\s+"([^"]+)"/)
  if (ag) attrs.agendaGroup = ag[1]
  const rfg = attr.match(/\bruleflow-group\s+"([^"]+)"/)
  if (rfg) attrs.ruleFlowGroup = rfg[1]
  return attrs
}

function extractWhenBlock(block: string): string {
  const m = block.match(/\bwhen\b([\s\S]*?)\bthen\b/)
  return m ? m[1].trim() : ''
}

function extractThenBlock(block: string): string {
  const m = block.match(/\bthen\b([\s\S]*?)\bend\b/)
  return m ? m[1].trim() : ''
}

// ─── CONDITION PARSING ────────────────────────────────────────────────────────

/**
 * Entry point for the when block. Returns the flat top-level condition list.
 * Top-level conditions are implicitly ANDed — each as a separate element.
 * An explicit top-level OR is wrapped in a single OrCondition element.
 */
function parseConditions(when: string): Condition[] {
  const text = when.trim()
  if (!text) return []

  // Top-level OR — split into branches; surrounding spaces prevent word collision
  const orParts = splitAtDepth0(text, ' or ')
  if (orParts.length > 1) {
    return [{ kind: 'Or', conditions: orParts.map(p => parseAndGroup(p.trim())) }]
  }

  const result = parseAndGroup(text)
  // Unroll a top-level And so Rule.conditions stays flat
  return result.kind === 'And' ? result.conditions : [result]
}

/** Parses a group that may contain top-level 'and' or implicit line-break ANDs. */
function parseAndGroup(text: string): Condition {
  const andParts = splitAndConditions(text)
  if (andParts.length === 1) return parseCondition(andParts[0])
  const conditions = andParts.map(parseCondition)
  return conditions.length === 1 ? conditions[0] : { kind: 'And', conditions }
}

/**
 * Splits a when block into individual condition strings.
 * Handles both explicit 'and' and implicit newline/whitespace separation.
 */
function splitAndConditions(text: string): string[] {
  const byAnd = splitAtDepth0(text, ' and ')
  if (byAnd.length > 1) return byAnd.filter(p => p.trim().length > 0)

  // Fall back to newline separation, merging lines with unbalanced parens
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length <= 1) return [text.trim()]

  const merged: string[] = []
  let current = ''
  let depth = 0

  for (const line of lines) {
    for (const ch of line) {
      if (ch === '(' || ch === '{') depth++
      else if (ch === ')' || ch === '}') depth--
    }
    current += (current ? ' ' : '') + line
    if (depth === 0) {
      merged.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) merged.push(current.trim())
  return merged.filter(p => p.length > 0)
}

/** Routes a single condition string to the appropriate parser. */
function parseCondition(raw: string): Condition {
  const text = raw.trim()

  // Parenthesised group — recurse into its contents
  if (text.startsWith('(') && text.endsWith(')')) {
    const inner = text.slice(1, -1).trim()
    const conditions = parseConditions(inner)
    return conditions.length === 1 ? conditions[0] : { kind: 'And', conditions }
  }

  if (/^not\s*\(/.test(text))
    return { kind: 'Not', condition: parseUnboundCondition(extractBalanced(text, '(', ')')) }

  if (/^not\s+\w/.test(text))
    return { kind: 'Not', condition: parseUnboundCondition(text.replace(/^not\s+/, '').trim()) }

  if (/^exists\s*\(/.test(text))
    return { kind: 'Exists', condition: parseUnboundCondition(extractBalanced(text, '(', ')')) }

  if (/^forall\s*\(/.test(text))
    return { kind: 'Forall', condition: parseCondition(extractBalanced(text, '(', ')')) }

  if (/^accumulate\s*\(/.test(text))
    return parseAccumulate(text)

  if (/^eval\s*\(/.test(text))
    return { kind: 'Eval', expression: extractBalanced(text, '(', ')').trim() }

  const fromIdx = indexAtDepth0(text, ' from ')
  if (fromIdx !== -1)
    return parseFrom(text, fromIdx)

  if (/^(\$\w+\s*:\s*)?\w[\w.]*\s*\(/.test(text))
    return parseFactPattern(text)

  return { kind: 'RawCondition', drl: text }
}

function parseFactPattern(text: string): FactPattern {
  const m = text.match(/^(\$\w+\s*:\s*)?(\w[\w.]*)\s*\(([\s\S]*)\)\s*$/)
  if (!m) return { kind: 'FactPattern', factType: text, constraints: [] }
  const binding = m[1] ? m[1].replace(':', '').trim() : undefined
  const constraints = m[3].trim() ? parseConstraints(m[3].trim()) : []
  return { kind: 'FactPattern', factType: m[2].trim(), binding, constraints }
}

// Parses a condition inside not()/exists() — strips any binding since those
// contexts forbid variable binding by Drools semantics.
function parseUnboundCondition(text: string): import('../metamodel/types').UnboundPattern | import('../metamodel/types').EvalCondition | import('../metamodel/types').RawCondition {
  const trimmed = text.trim()
  if (/^eval\s*\(/.test(trimmed))
    return { kind: 'Eval', expression: extractBalanced(trimmed, '(', ')').trim() }
  const m = trimmed.match(/^(?:\$\w+\s*:\s*)?(\w[\w.]*)\s*\(([\s\S]*)\)\s*$/)
  if (m) {
    const constraints = m[2].trim() ? parseConstraints(m[2].trim()) : []
    return { kind: 'UnboundPattern', factType: m[1].trim(), constraints }
  }
  return { kind: 'RawCondition', drl: trimmed }
}

function parseConstraints(text: string): Constraint[] {
  return splitAtDepth0(text, ',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(parseConstraint)
}

function parseConstraint(text: string): Constraint {
  const s = text.trim()

  // Pure binding: $v : field (no operator)
  const bindingOnly = s.match(/^(\$\w+)\s*:\s*(\w[\w.]*)$/)
  if (bindingOnly)
    return { kind: 'BindingConstraint', binding: bindingOnly[1], field: bindingOnly[2] }

  // Longest-match operator scan to avoid 'not contains' being split as 'not'+'contains'
  const OPERATORS: ConstraintOperator[] = [
    'not contains', 'not memberOf', 'not matches',
    'contains', 'memberOf', 'matches',
    '==', '!=', '>=', '<=', '>', '<'
  ]
  for (const op of OPERATORS) {
    const idx = indexAtDepth0(s, op)
    if (idx === -1) continue
    const lhs = s.slice(0, idx).trim()
    const rhs = s.slice(idx + op.length).trim()
    const lhsMatch = lhs.match(/^(\$\w+)\s*:\s*(\w[\w.]*)$/)
    return {
      kind: 'FieldConstraint',
      field: lhsMatch ? lhsMatch[2] : lhs,
      operator: op,
      value: rhs,
      ...(lhsMatch && { binding: lhsMatch[1] })
    }
  }

  return { kind: 'RawConstraint', expression: s }
}

function parseAccumulate(text: string): AccumulatePattern {
  const inner = extractBalanced(text, '(', ')').trim()
  const parts = splitAtDepth0(inner, ';')
  const source: Condition = parts[0]
    ? parseCondition(parts[0].trim())
    : { kind: 'RawCondition', drl: '' }
  const functions: AccumulateFunction[] = []
  let resultConstraint: string | undefined

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim()
    const candidates = splitAtDepth0(part, ',')
    const parsed: AccumulateFunction[] = []
    let allFunctions = true

    for (const candidate of candidates) {
      const fn = candidate.trim().match(/^(\$\w+)\s*:\s*(\w+)\s*\(([^)]*)\)$/)
      if (fn) parsed.push({ binding: fn[1], function: fn[2], argument: fn[3].trim() })
      else { allFunctions = false; break }
    }

    if (allFunctions && parsed.length > 0) functions.push(...parsed)
    else resultConstraint = part
  }

  return { kind: 'Accumulate', source, functions, ...(resultConstraint && { resultConstraint }) }
}

function parseFrom(text: string, fromIdx: number): FromCondition {
  return {
    kind: 'From',
    pattern: parseFactPattern(text.slice(0, fromIdx).trim()),
    expression: text.slice(fromIdx + ' from '.length).trim()
  }
}

// ─── CONSEQUENCE PARSING ─────────────────────────────────────────────────────

function parseConsequences(then: string): Consequence[] {
  const consequences: Consequence[] = []
  let remaining = then.trim()
  while (remaining.length > 0) {
    const result = parseNextConsequence(remaining)
    if (!result) break
    consequences.push(result.consequence)
    remaining = result.rest.trim()
  }
  return consequences
}

function parseNextConsequence(text: string): { consequence: Consequence; rest: string } | null {
  const t = text.trim()
  if (!t) return null

  // modify( $binding ) { ... }
  if (/^modify\s*\(/.test(t)) {
    const m = t.match(/^modify\s*\(\s*(\$\w+)\s*\)/)
    if (m) {
      const afterBinding = t.slice(m[0].length).trim()
      const block = extractBalanced(afterBinding, '{', '}')
      const endIdx = afterBinding.indexOf('{') + block.length + 2
      return {
        consequence: { kind: 'ModifyConsequence', binding: m[1], modifications: parseModifications(block) },
        rest: afterBinding.slice(endIdx)
      }
    }
  }

  // insert( ... );
  if (/^insert\s*\(/.test(t)) {
    const inner = extractBalanced(t, '(', ')')
    const rest = t.slice(t.indexOf('(') + inner.length + 2).replace(/^\s*;/, '')
    return { consequence: { kind: 'InsertConsequence', objectExpression: inner.trim() }, rest }
  }

  // retract( $binding );
  if (/^retract\s*\(/.test(t)) {
    const inner = extractBalanced(t, '(', ')')
    const rest = t.slice(t.indexOf('(') + inner.length + 2).replace(/^\s*;/, '')
    return { consequence: { kind: 'RetractConsequence', binding: inner.trim() }, rest }
  }

  // Any other statement ending with ;
  const semiIdx = indexAtDepth0(t, ';')
  if (semiIdx !== -1)
    return { consequence: { kind: 'RawConsequence', code: t.slice(0, semiIdx).trim() }, rest: t.slice(semiIdx + 1) }

  return { consequence: { kind: 'RawConsequence', code: t }, rest: '' }
}

function parseModifications(block: string): Modification[] {
  return splitAtDepth0(block, ',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(text => {
      const m = text.match(/^(\w+)\s*\(([\s\S]*)\)$/)
      if (!m) return { method: text, args: [] }
      const args = m[2].trim() ? splitAtDepth0(m[2].trim(), ',').map(a => a.trim()) : []
      return { method: m[1], args }
    })
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export const DRLToMetaTransformer = {

  parse(drl: string): DroolsFile {
    const clean = stripComments(drl)
    return {
      name: 'parsed',
      imports: parseImports(clean),
      rules: extractRuleBlocks(clean).map(block => DRLToMetaTransformer.parseRule(block))
    }
  },

  parseRule(block: string): Rule {
    return {
      name: parseRuleName(block),
      ...parseRuleAttributes(block),
      conditions: parseConditions(extractWhenBlock(block)),
      consequences: parseConsequences(extractThenBlock(block))
    }
  }
}
