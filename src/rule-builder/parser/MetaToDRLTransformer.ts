import type { AndCondition, Condition, Consequence, Constraint, DroolsFile, Rule } from '../metamodel/types'

// ─── CONSTRAINT GENERATION ───────────────────────────────────────────────────

function generateConstraint(c: Constraint): string {
  switch (c.kind) {
    case 'FieldConstraint':
      return `${c.binding ? `${c.binding} : ` : ''}${c.field} ${c.operator} ${c.value}`
    case 'BindingConstraint':
      return `${c.binding} : ${c.field}`
    case 'RawConstraint':
      return c.expression
  }
}

// ─── CONDITION GENERATION ────────────────────────────────────────────────────

function generateCondition(cond: Condition, indent = '    '): string {
  switch (cond.kind) {

    case 'FactPattern': {
      const binding = cond.binding ? `${cond.binding} : ` : ''
      const constraints = cond.constraints.map(generateConstraint).join(', ')
      return `${binding}${cond.factType}( ${constraints} )`
    }

    case 'UnboundPattern': {
      // No binding — used inside not() and forall() where binding is forbidden
      const constraints = cond.constraints.map(generateConstraint).join(', ')
      return `${cond.factType}( ${constraints} )`
    }

    case 'And': {
      const parts = cond.conditions.map(c => generateCondition(c, indent + '  '))
      return `( ${parts.join(`\n${indent}  and `)} )`
    }

    case 'Or': {
      const parts = cond.conditions.map(c => generateCondition(c, indent + '  '))
      return `( ${parts.join(`\n${indent}  or `)} )`
    }

    case 'Not':
      return `not( ${generateCondition(cond.condition, indent)} )`

    case 'Exists':
      return `exists( ${generateCondition(cond.condition, indent)} )`

    case 'Forall':
      return `forall( ${generateCondition(cond.condition, indent)} )`

    case 'Accumulate': {
      const source = generateCondition(cond.source, indent + '  ')
      const fns = cond.functions.map(f => `${f.binding} : ${f.function}( ${f.argument} )`).join(', ')
      const result = cond.resultConstraint ? `;\n${indent}  ${cond.resultConstraint}` : ''
      return `accumulate(\n${indent}  ${source};\n${indent}  ${fns}${result}\n${indent})`
    }

    case 'From':
      return `${generateCondition(cond.pattern, indent)} from ${cond.expression}`

    case 'Eval':
      return `eval( ${cond.expression} )`

    case 'RawCondition':
      return cond.drl
  }
}

/**
 * Generates the when block from the top-level condition list.
 * Each condition on its own line (implicit AND).
 * A single AndCondition is unrolled into individual lines.
 */
function generateWhenBlock(conditions: Condition[], indent = '    '): string {
  const flat = conditions.length === 1 && conditions[0].kind === 'And'
    ? (conditions[0] as AndCondition).conditions
    : conditions
  return flat.map(c => `${indent}${generateCondition(c, indent)}`).join('\n')
}

// ─── CONSEQUENCE GENERATION ──────────────────────────────────────────────────

function generateConsequence(cons: Consequence, indent = '    '): string {
  switch (cons.kind) {
    case 'ModifyConsequence': {
      const mods = cons.modifications
        .map(m => `${m.method}( ${m.args.join(', ')} )`)
        .join(`,\n${indent}  `)
      return `modify( ${cons.binding} ) {\n${indent}  ${mods}\n${indent}}`
    }
    case 'InsertConsequence':
      return `insert( ${cons.objectExpression} );`
    case 'RetractConsequence':
      return `retract( ${cons.binding} );`
    case 'SetGlobalConsequence':
      return `${cons.expression};`
    case 'RawConsequence':
      return `${cons.code};`
  }
}

// ─── RULE GENERATION ─────────────────────────────────────────────────────────

function generateRule(rule: Rule): string {
  const lines = [`rule "${rule.name}"`]
  if (rule.salience !== undefined)    lines.push(`  salience ${rule.salience}`)
  if (rule.agendaGroup !== undefined) lines.push(`  agenda-group "${rule.agendaGroup}"`)
  if (rule.ruleFlowGroup !== undefined) lines.push(`  ruleflow-group "${rule.ruleFlowGroup}"`)
  if (rule.noLoop)                    lines.push('  no-loop true')
  if (rule.lockOnActive)              lines.push('  lock-on-active true')
  lines.push('  when')
  lines.push(generateWhenBlock(rule.conditions))
  lines.push('  then')
  lines.push(rule.consequences.map(c => `    ${generateConsequence(c)}`).join('\n'))
  lines.push('end')
  return lines.join('\n')
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export const MetaToDRLTransformer = {

  generate(file: DroolsFile): string {
    const sections: string[] = []
    if (file.imports.length > 0)
      sections.push(file.imports.map(i => `import ${i};`).join('\n'))
    if (file.globals.length > 0)
      sections.push(file.globals.map(g => `global ${g.type} ${g.name};`).join('\n'))
    sections.push(file.rules.map(generateRule).join('\n\n'))
    return sections.join('\n\n')
  },

  generateRule(rule: Rule): string {
    return generateRule(rule)
  }
}
