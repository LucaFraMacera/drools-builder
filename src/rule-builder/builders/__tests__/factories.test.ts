import { describe, it, expect } from 'vitest'
import {
  createRule,
  fact, unbound,
  not, exists,
  or, and, forall,
  accumulate, from_, eval_, rawCondition,
  modify, insert, retract, setGlobal, rawConsequence,
} from '../index'
import { Operator, Aggregate } from '../enums'
import { PatternBuilder, UnboundPatternBuilder } from '../PatternBuilder'
import { AccumulateBuilder } from '../AccumulateBuilder'
import type { UnboundPattern } from '../../metamodel/types'

// ─── Condition factories ──────────────────────────────────────────────────────

describe('fact()', () => {
  it('returns a PatternBuilder', () => {
    expect(fact('Player')).toBeInstanceOf(PatternBuilder)
  })

  it('produces a FactPattern without binding', () => {
    const p = fact('Player').build()
    expect(p).toEqual({ kind: 'FactPattern', factType: 'Player', constraints: [] })
  })

  it('produces a FactPattern with binding', () => {
    const p = fact('Player', '$p').build()
    expect(p).toMatchObject({ kind: 'FactPattern', binding: '$p' })
  })

  it('chains constraints', () => {
    const p = fact('Player', '$p')
      .field('score', Operator.Gte, '100')
      .build()
    expect(p.constraints).toHaveLength(1)
  })
})

describe('unbound()', () => {
  it('returns an UnboundPatternBuilder', () => {
    expect(unbound('Alert')).toBeInstanceOf(UnboundPatternBuilder)
  })

  it('produces an UnboundPattern', () => {
    const p = unbound('Alert').field('status', Operator.Eq, '"OPEN"').build()
    expect(p).toMatchObject({ kind: 'UnboundPattern', factType: 'Alert' })
    expect(p.constraints).toHaveLength(1)
  })
})

describe('not()', () => {
  it('accepts an UnboundPatternBuilder', () => {
    const c = not(unbound('Alert').field('status', Operator.Eq, '"OPEN"'))
    expect(c).toMatchObject({ kind: 'Not', condition: { kind: 'UnboundPattern' } })
  })

  it('accepts a plain UnboundPattern object', () => {
    const pattern: UnboundPattern = { kind: 'UnboundPattern', factType: 'Alert', constraints: [] }
    const c = not(pattern)
    expect(c).toMatchObject({ kind: 'Not', condition: { kind: 'UnboundPattern' } })
  })

  it('accepts an EvalCondition', () => {
    const c = not({ kind: 'Eval' as const, expression: 'x > 0' })
    expect(c).toMatchObject({ kind: 'Not', condition: { kind: 'Eval' } })
  })

  it('accepts a RawCondition', () => {
    const c = not({ kind: 'RawCondition' as const, drl: 'some drl' })
    expect(c).toMatchObject({ kind: 'Not', condition: { kind: 'RawCondition' } })
  })
})

describe('exists()', () => {
  it('accepts an UnboundPatternBuilder', () => {
    const c = exists(unbound('Alert'))
    expect(c).toMatchObject({ kind: 'Exists', condition: { kind: 'UnboundPattern' } })
  })

  it('accepts a plain UnboundPattern', () => {
    const c = exists({ kind: 'UnboundPattern' as const, factType: 'Alert', constraints: [] })
    expect(c.kind).toBe('Exists')
  })
})

describe('or()', () => {
  it('wraps conditions in an OrCondition', () => {
    const c = or(fact('A'), fact('B'))
    expect(c.kind).toBe('Or')
    expect(c.conditions).toHaveLength(2)
  })

  it('resolves builders', () => {
    const c = or(fact('Player', '$p').field('score', Operator.Gte, '0'), fact('Game'))
    expect(c.conditions[0]).toMatchObject({ kind: 'FactPattern', factType: 'Player' })
  })

  it('accepts plain Condition objects', () => {
    const c = or(
      { kind: 'Eval' as const, expression: 'x > 0' },
      { kind: 'RawCondition' as const, drl: 'raw' },
    )
    expect(c.conditions).toHaveLength(2)
  })
})

describe('and()', () => {
  it('wraps conditions in an AndCondition', () => {
    const c = and(fact('A'), fact('B'), fact('C'))
    expect(c.kind).toBe('And')
    expect(c.conditions).toHaveLength(3)
  })
})

describe('forall()', () => {
  it('wraps a condition in a ForallCondition', () => {
    const c = forall(fact('Transaction', '$tx'))
    expect(c).toMatchObject({ kind: 'Forall', condition: { kind: 'FactPattern' } })
  })

  it('accepts a plain Condition', () => {
    const c = forall({ kind: 'Eval' as const, expression: 'x > 0' })
    expect(c.condition).toMatchObject({ kind: 'Eval' })
  })
})

describe('accumulate()', () => {
  it('returns an AccumulateBuilder', () => {
    expect(accumulate(fact('Transaction', '$tx'))).toBeInstanceOf(AccumulateBuilder)
  })

  it('builds an AccumulatePattern', () => {
    const acc = accumulate(fact('Transaction', '$tx'))
      .fn('$total', Aggregate.Sum, '$tx.amount')
      .resultConstraint('$total > 1000')
      .build()
    expect(acc.kind).toBe('Accumulate')
    expect(acc.functions).toHaveLength(1)
    expect(acc.resultConstraint).toBe('$total > 1000')
  })
})

describe('from_()', () => {
  it('builds a FromCondition', () => {
    const c = from_(fact('Transaction', '$tx'), '$txList')
    expect(c).toEqual({
      kind: 'From',
      pattern: { kind: 'FactPattern', factType: 'Transaction', binding: '$tx', constraints: [] },
      expression: '$txList',
    })
  })
})

describe('eval_()', () => {
  it('builds an EvalCondition', () => {
    const c = eval_('score > threshold')
    expect(c).toEqual({ kind: 'Eval', expression: 'score > threshold' })
  })
})

describe('rawCondition()', () => {
  it('builds a RawCondition', () => {
    const c = rawCondition('$p : Player( score > 0 )')
    expect(c).toEqual({ kind: 'RawCondition', drl: '$p : Player( score > 0 )' })
  })
})

// ─── Consequence factories ────────────────────────────────────────────────────

describe('modify()', () => {
  it('builds a ModifyConsequence via builder', () => {
    const c = modify('$p').call('setScore', '200').build()
    expect(c).toMatchObject({ kind: 'ModifyConsequence', binding: '$p' })
  })
})

describe('insert()', () => {
  it('builds an InsertConsequence', () => {
    expect(insert('new Alert()')).toEqual({ kind: 'InsertConsequence', objectExpression: 'new Alert()' })
  })
})

describe('retract()', () => {
  it('builds a RetractConsequence', () => {
    expect(retract('$p')).toEqual({ kind: 'RetractConsequence', binding: '$p' })
  })
})

describe('setGlobal()', () => {
  it('builds a SetGlobalConsequence', () => {
    expect(setGlobal('service.log()')).toEqual({ kind: 'SetGlobalConsequence', expression: 'service.log()' })
  })
})

describe('rawConsequence()', () => {
  it('builds a RawConsequence', () => {
    expect(rawConsequence('System.out.println("x")')).toEqual({
      kind: 'RawConsequence', code: 'System.out.println("x")',
    })
  })
})

// ─── Integration: full rule via factory functions only ────────────────────────

describe('full rule via factory functions', () => {
  it('builds the expected Rule structure', () => {
    const rule = createRule('Award Badge')
      .salience(10)
      .agendaGroup('classification')
      .noLoop()
      .addCondition(
        fact('Player', '$player')
          .field('score', Operator.Gte, '100')
          .bind('$id', 'id'),
      )
      .addCondition(
        not(unbound('BadgeCollectionConcept').field('name', Operator.Eq, '"gold"')),
      )
      .addConsequence(
        modify('$player').call('awardBadge', '"gold"'),
      )
      .build()

    expect(rule.name).toBe('Award Badge')
    expect(rule.salience).toBe(10)
    expect(rule.agendaGroup).toBe('classification')
    expect(rule.noLoop).toBe(true)
    expect(rule.conditions).toHaveLength(2)
    expect(rule.conditions[0]).toMatchObject({ kind: 'FactPattern', factType: 'Player', binding: '$player' })
    expect(rule.conditions[1]).toMatchObject({ kind: 'Not', condition: { kind: 'UnboundPattern', factType: 'BadgeCollectionConcept' } })
    expect(rule.consequences).toHaveLength(1)
    expect(rule.consequences[0]).toMatchObject({ kind: 'ModifyConsequence', binding: '$player' })
  })
})
