import { describe, it, expect } from 'vitest'
import { DRLToMetaTransformer } from '../DRLToMetaTransformer'
import { Operator, Aggregate } from '../../builders/enums'
import type { FactPattern, OrCondition, AccumulatePattern, FromCondition } from '../../metamodel/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRule(drl: string) {
  return DRLToMetaTransformer.parse(`rule "Test"\nwhen\n${drl}\nthen\nend`).rules[0]
}

function parseThen(drl: string) {
  return DRLToMetaTransformer.parse(`rule "Test"\nwhen\nthen\n${drl}\nend`).rules[0]
}

// ─── File-level parsing ───────────────────────────────────────────────────────

describe('DRLToMetaTransformer.parse() — file level', () => {
  it('parses imports', () => {
    const file = DRLToMetaTransformer.parse(`
      import com.example.model.Player;
      import com.example.model.Game;
      rule "R" when then end
    `)
    expect(file.imports).toEqual(['com.example.model.Player', 'com.example.model.Game'])
  })

  it('returns an empty imports array when there are none', () => {
    const file = DRLToMetaTransformer.parse('rule "R" when then end')
    expect(file.imports).toEqual([])
  })

  it('parses multiple rules', () => {
    const file = DRLToMetaTransformer.parse(`
      rule "Rule One" when then end
      rule "Rule Two" when then end
    `)
    expect(file.rules).toHaveLength(2)
    expect(file.rules[0].name).toBe('Rule One')
    expect(file.rules[1].name).toBe('Rule Two')
  })

  it('strips single-line comments', () => {
    const file = DRLToMetaTransformer.parse(`
      // This is a comment
      rule "R" when then end
    `)
    expect(file.rules).toHaveLength(1)
  })

  it('strips block comments', () => {
    const file = DRLToMetaTransformer.parse(`
      /* block comment */
      rule "R" when then end
    `)
    expect(file.rules).toHaveLength(1)
  })
})

// ─── Rule attributes ──────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — rule attributes', () => {
  it('parses rule name', () => {
    const rule = DRLToMetaTransformer.parse('rule "My Rule" when then end').rules[0]
    expect(rule.name).toBe('My Rule')
  })

  it('parses salience', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" salience 100 when then end').rules[0]
    expect(rule.salience).toBe(100)
  })

  it('parses negative salience', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" salience -5 when then end').rules[0]
    expect(rule.salience).toBe(-5)
  })

  it('parses no-loop true', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" no-loop true when then end').rules[0]
    expect(rule.noLoop).toBe(true)
  })

  it('parses lock-on-active true', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" lock-on-active true when then end').rules[0]
    expect(rule.lockOnActive).toBe(true)
  })

  it('parses agenda-group', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" agenda-group "fraud" when then end').rules[0]
    expect(rule.agendaGroup).toBe('fraud')
  })

  it('parses ruleflow-group', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" ruleflow-group "flow1" when then end').rules[0]
    expect(rule.ruleFlowGroup).toBe('flow1')
  })
})

// ─── Condition parsing ────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — FactPattern', () => {
  it('parses a FactPattern with binding', () => {
    const rule = parseRule(`$p : Player( score ${Operator.Gte} 100 )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.kind).toBe('FactPattern')
    expect(c.factType).toBe('Player')
    expect(c.binding).toBe('$p')
    expect(c.constraints).toHaveLength(1)
    expect(c.constraints[0]).toMatchObject({
      kind: 'FieldConstraint',
      field: 'score',
      operator: Operator.Gte,
      value: '100',
    })
  })

  it('parses a FactPattern without binding', () => {
    const rule = parseRule(`Player( score ${Operator.Gte} 100 )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.binding).toBeUndefined()
    expect(c.factType).toBe('Player')
  })

  it('parses a FactPattern with no constraints', () => {
    const rule = parseRule('Player()')
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints).toEqual([])
  })

  it('parses a BindingConstraint', () => {
    const rule = parseRule('$p : Player( $id : id )')
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toEqual({ kind: 'BindingConstraint', binding: '$id', field: 'id' })
  })

  it('parses all standard equality and comparison operators', () => {
    const operators = [Operator.Eq, Operator.Neq, Operator.Gt, Operator.Lt, Operator.Gte, Operator.Lte]
    for (const op of operators) {
      const rule = parseRule(`$p : Player( score ${op} 100 )`)
      const c = rule.conditions[0] as FactPattern
      expect(c.constraints[0]).toMatchObject({ kind: 'FieldConstraint', operator: op })
    }
  })

  it('parses multi-word operator: NotContains', () => {
    const rule = parseRule(`$p : Player( tags ${Operator.NotContains} "vip" )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.NotContains })
  })

  it('parses multi-word operator: NotMemberOf', () => {
    const rule = parseRule(`$p : Player( role ${Operator.NotMemberOf} $roles )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.NotMemberOf })
  })

  it('parses multi-word operator: Contains', () => {
    const rule = parseRule(`$p : Player( tags ${Operator.Contains} "admin" )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.Contains })
  })

  it('parses multi-word operator: MemberOf', () => {
    const rule = parseRule(`$p : Player( role ${Operator.MemberOf} $roles )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.MemberOf })
  })

  it('parses multiple constraints on one pattern', () => {
    const rule = parseRule(`$p : Player( score ${Operator.Gte} 100, active ${Operator.Eq} true )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints).toHaveLength(2)
  })
})

describe('DRLToMetaTransformer — not() condition', () => {
  it('parses not() wrapping an UnboundPattern', () => {
    const rule = parseRule(`not( FraudAlert( status ${Operator.Eq} "UNRESOLVED" ) )`)
    expect(rule.conditions[0]).toMatchObject({
      kind: 'Not',
      condition: { kind: 'UnboundPattern', factType: 'FraudAlert' },
    })
  })
})

describe('DRLToMetaTransformer — exists() condition', () => {
  it('parses exists() wrapping an UnboundPattern', () => {
    const rule = parseRule(`exists( Player( score ${Operator.Gt} 0 ) )`)
    expect(rule.conditions[0]).toMatchObject({
      kind: 'Exists',
      condition: { kind: 'UnboundPattern', factType: 'Player' },
    })
  })
})

describe('DRLToMetaTransformer — or() condition', () => {
  it('parses an explicit or keyword', () => {
    const rule = parseRule(`$p : Player( score ${Operator.Gt} 0 ) or $p : Player( vip ${Operator.Eq} true )`)
    const c = rule.conditions[0] as OrCondition
    expect(c.kind).toBe('Or')
    expect(c.conditions).toHaveLength(2)
  })
})

describe('DRLToMetaTransformer — eval() condition', () => {
  it('parses an eval condition', () => {
    const rule = parseRule('eval( $p.getScore() > 100 )')
    expect(rule.conditions[0]).toEqual({ kind: 'Eval', expression: '$p.getScore() > 100' })
  })
})

describe('DRLToMetaTransformer — accumulate condition', () => {
  it('parses an accumulate with a single function', () => {
    const rule = parseRule(`
      accumulate(
        $tx : Transaction( amount ${Operator.Gt} 0 );
        $total : ${Aggregate.Sum}( $tx.amount )
      )
    `)
    const c = rule.conditions[0] as AccumulatePattern
    expect(c.kind).toBe('Accumulate')
    expect(c.source).toMatchObject({ kind: 'FactPattern', factType: 'Transaction' })
    expect(c.functions).toHaveLength(1)
    expect(c.functions[0]).toEqual({
      binding: '$total',
      function: Aggregate.Sum,
      argument: '$tx.amount',
    })
  })

  it('parses an accumulate with multiple functions', () => {
    const rule = parseRule(`
      accumulate(
        $tx : Transaction( amount ${Operator.Gt} 0 );
        $total : ${Aggregate.Sum}( $tx.amount ), $count : ${Aggregate.Count}( $tx )
      )
    `)
    const c = rule.conditions[0] as AccumulatePattern
    expect(c.functions).toHaveLength(2)
    expect(c.functions[0].function).toBe(Aggregate.Sum)
    expect(c.functions[1].function).toBe(Aggregate.Count)
  })
})

describe('DRLToMetaTransformer — from condition', () => {
  it('parses a from condition', () => {
    const rule = parseRule(`$tx : Transaction( amount ${Operator.Gt} 0 ) from $txList`)
    const c = rule.conditions[0] as FromCondition
    expect(c.kind).toBe('From')
    expect(c.pattern).toMatchObject({ kind: 'FactPattern', factType: 'Transaction' })
    expect(c.expression).toBe('$txList')
  })
})

// ─── Consequence parsing ──────────────────────────────────────────────────────

describe('DRLToMetaTransformer — consequences', () => {
  it('parses a modify consequence', () => {
    const rule = parseThen('modify( $p ) { setScore( 200 ) };')
    expect(rule.consequences[0]).toMatchObject({
      kind: 'ModifyConsequence',
      binding: '$p',
      modifications: [{ method: 'setScore', args: ['200'] }],
    })
  })

  it('parses a modify with multiple modifications', () => {
    const rule = parseThen('modify( $p ) { setScore( 200 ), setLevel( 3 ) };')
    const c = rule.consequences[0] as any
    expect(c.modifications).toHaveLength(2)
  })

  it('parses an insert consequence', () => {
    const rule = parseThen('insert( new Alert() );')
    expect(rule.consequences[0]).toEqual({ kind: 'InsertConsequence', objectExpression: 'new Alert()' })
  })

  it('parses a retract consequence', () => {
    const rule = parseThen('retract( $p );')
    expect(rule.consequences[0]).toEqual({ kind: 'RetractConsequence', binding: '$p' })
  })

  it('parses an unknown statement as RawConsequence', () => {
    const rule = parseThen('System.out.println("hello");')
    expect(rule.consequences[0]).toMatchObject({ kind: 'RawConsequence', code: 'System.out.println("hello")' })
  })

  it('parses multiple consequences in sequence', () => {
    const rule = parseThen('insert( new Alert() );\nretract( $p );')
    expect(rule.consequences).toHaveLength(2)
  })
})
