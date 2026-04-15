import { describe, it, expect } from 'vitest'
import { PatternBuilder, UnboundPatternBuilder } from '../PatternBuilder'
import { AccumulateBuilder } from '../AccumulateBuilder'
import { ModifyBuilder } from '../ModifyBuilder'
import { LHSBuilder } from '../LHSBuilder'
import { RHSBuilder } from '../RHSBuilder'
import { RuleBuilder, createRule } from '../RuleBuilder'
import { Operator, Aggregate } from '../enums'

// ─── PatternBuilder ───────────────────────────────────────────────────────────

describe('PatternBuilder', () => {
  it('builds a FactPattern without binding', () => {
    const pattern = new PatternBuilder('Player').build()
    expect(pattern).toEqual({ kind: 'FactPattern', factType: 'Player', constraints: [] })
  })

  it('builds a FactPattern with binding', () => {
    const pattern = new PatternBuilder('Player', '$p').build()
    expect(pattern).toEqual({ kind: 'FactPattern', factType: 'Player', binding: '$p', constraints: [] })
  })

  it('adds a FieldConstraint via .field()', () => {
    const pattern = new PatternBuilder('Player', '$p')
      .field('score', Operator.Gte, '100')
      .build()
    expect(pattern.constraints).toEqual([
      { kind: 'FieldConstraint', field: 'score', operator: '>=', value: '100' },
    ])
  })

  it('adds a FieldConstraint with a result binding', () => {
    const pattern = new PatternBuilder('Player', '$p')
      .field('score', Operator.Gte, '100', '$sc')
      .build()
    expect(pattern.constraints[0]).toMatchObject({ kind: 'FieldConstraint', binding: '$sc' })
  })

  it('adds a BindingConstraint via .bind()', () => {
    const pattern = new PatternBuilder('Player', '$p')
      .bind('$id', 'id')
      .build()
    expect(pattern.constraints).toEqual([
      { kind: 'BindingConstraint', binding: '$id', field: 'id' },
    ])
  })

  it('adds a RawConstraint via .raw()', () => {
    const pattern = new PatternBuilder('Player', '$p')
      .raw('score > threshold')
      .build()
    expect(pattern.constraints).toEqual([
      { kind: 'RawConstraint', expression: 'score > threshold' },
    ])
  })

  it('chains multiple constraints', () => {
    const pattern = new PatternBuilder('Player', '$p')
      .field('score', Operator.Gte, '100')
      .bind('$id', 'id')
      .raw('active == true')
      .build()
    expect(pattern.constraints).toHaveLength(3)
  })
})

// ─── UnboundPatternBuilder ────────────────────────────────────────────────────

describe('UnboundPatternBuilder', () => {
  it('builds an UnboundPattern', () => {
    const p = new UnboundPatternBuilder('FraudAlert').build()
    expect(p).toEqual({ kind: 'UnboundPattern', factType: 'FraudAlert', constraints: [] })
  })

  it('adds field constraints', () => {
    const p = new UnboundPatternBuilder('FraudAlert')
      .field('status', Operator.Eq, '"UNRESOLVED"')
      .build()
    expect(p.constraints).toHaveLength(1)
    expect(p.constraints[0]).toMatchObject({ kind: 'FieldConstraint', field: 'status' })
  })

  it('adds raw constraints', () => {
    const p = new UnboundPatternBuilder('FraudAlert')
      .raw('someExpression')
      .build()
    expect(p.constraints[0]).toEqual({ kind: 'RawConstraint', expression: 'someExpression' })
  })
})

// ─── AccumulateBuilder ────────────────────────────────────────────────────────

describe('AccumulateBuilder', () => {
  const source = new PatternBuilder('Transaction', '$tx').build()

  it('builds an AccumulatePattern with one function', () => {
    const acc = new AccumulateBuilder(source)
      .fn('$total', Aggregate.Sum, '$tx.amount')
      .build()
    expect(acc.kind).toBe('Accumulate')
    expect(acc.source).toEqual(source)
    expect(acc.functions).toEqual([{ binding: '$total', function: 'sum', argument: '$tx.amount' }])
    expect(acc.resultConstraint).toBeUndefined()
  })

  it('supports multiple functions', () => {
    const acc = new AccumulateBuilder(source)
      .fn('$total', Aggregate.Sum, '$tx.amount')
      .fn('$count', Aggregate.Count, '$tx')
      .build()
    expect(acc.functions).toHaveLength(2)
  })

  it('sets resultConstraint', () => {
    const acc = new AccumulateBuilder(source)
      .fn('$total', Aggregate.Sum, '$tx.amount')
      .resultConstraint('$total > 1000')
      .build()
    expect(acc.resultConstraint).toBe('$total > 1000')
  })

  it('accepts string function name as well as enum', () => {
    const acc = new AccumulateBuilder(source)
      .fn('$list', 'collectList', '$tx')
      .build()
    expect(acc.functions[0].function).toBe('collectList')
  })
})

// ─── ModifyBuilder ────────────────────────────────────────────────────────────

describe('ModifyBuilder', () => {
  it('builds a ModifyConsequence with a single call', () => {
    const m = new ModifyBuilder('$p').call('setScore', '200').build()
    expect(m).toEqual({
      kind: 'ModifyConsequence',
      binding: '$p',
      modifications: [{ method: 'setScore', args: ['200'] }],
    })
  })

  it('chains multiple calls', () => {
    const m = new ModifyBuilder('$p')
      .call('setScore', '200')
      .call('setLevel', '3')
      .build()
    expect(m.modifications).toHaveLength(2)
  })

  it('supports multiple args per call', () => {
    const m = new ModifyBuilder('$p').call('transfer', '$source', '$target').build()
    expect(m.modifications[0].args).toEqual(['$source', '$target'])
  })

  it('supports no-arg calls', () => {
    const m = new ModifyBuilder('$p').call('reset').build()
    expect(m.modifications[0].args).toEqual([])
  })
})

// ─── LHSBuilder ───────────────────────────────────────────────────────────────

describe('LHSBuilder', () => {
  it('.fact() without binding or callback', () => {
    const lhs = new LHSBuilder().fact('Player')
    expect(lhs._conditions[0]).toMatchObject({ kind: 'FactPattern', factType: 'Player' })
  })

  it('.fact() with binding only', () => {
    const lhs = new LHSBuilder().fact('Player', '$p')
    expect(lhs._conditions[0]).toMatchObject({ kind: 'FactPattern', binding: '$p' })
  })

  it('.fact() with callback only', () => {
    const lhs = new LHSBuilder().fact('Player', p => p.field('score', Operator.Gte, '100'))
    expect((lhs._conditions[0] as any).constraints).toHaveLength(1)
  })

  it('.fact() with binding and callback', () => {
    const lhs = new LHSBuilder().fact('Player', '$p', p => p.field('score', Operator.Gte, '100'))
    const c = lhs._conditions[0] as any
    expect(c.binding).toBe('$p')
    expect(c.constraints).toHaveLength(1)
  })

  it('.not() creates a NotCondition', () => {
    const lhs = new LHSBuilder().not(b => b.fact('FraudAlert'))
    expect(lhs._conditions[0]).toMatchObject({ kind: 'Not', condition: { kind: 'UnboundPattern' } })
  })

  it('.not() with eval inside', () => {
    const lhs = new LHSBuilder().not(b => b.eval('x > 0'))
    expect(lhs._conditions[0]).toMatchObject({ kind: 'Not', condition: { kind: 'Eval', expression: 'x > 0' } })
  })

  it('.not() with raw inside', () => {
    const lhs = new LHSBuilder().not(b => b.raw('some drl'))
    expect(lhs._conditions[0]).toMatchObject({ kind: 'Not', condition: { kind: 'RawCondition', drl: 'some drl' } })
  })

  it('.exists() creates an ExistsCondition', () => {
    const lhs = new LHSBuilder().exists(b => b.fact('Alert'))
    expect(lhs._conditions[0]).toMatchObject({ kind: 'Exists', condition: { kind: 'UnboundPattern' } })
  })

  it('.or() creates an OrCondition', () => {
    const lhs = new LHSBuilder().or(inner => {
      inner.fact('A')
      inner.fact('B')
    })
    const c = lhs._conditions[0] as any
    expect(c.kind).toBe('Or')
    expect(c.conditions).toHaveLength(2)
  })

  it('.and() creates an AndCondition', () => {
    const lhs = new LHSBuilder().and(inner => {
      inner.fact('A')
      inner.fact('B')
    })
    expect(lhs._conditions[0]).toMatchObject({ kind: 'And' })
  })

  it('.forall() with a single inner condition', () => {
    const lhs = new LHSBuilder().forall(inner => inner.fact('Transaction', '$tx'))
    expect(lhs._conditions[0]).toMatchObject({ kind: 'Forall', condition: { kind: 'FactPattern' } })
  })

  it('.forall() wraps multiple inner conditions in And', () => {
    const lhs = new LHSBuilder().forall(inner => {
      inner.fact('A')
      inner.fact('B')
    })
    const c = lhs._conditions[0] as any
    expect(c.kind).toBe('Forall')
    expect(c.condition.kind).toBe('And')
  })

  it('.accumulate() creates an AccumulatePattern', () => {
    const lhs = new LHSBuilder().accumulate(
      src => src.fact('Transaction', '$tx'),
      acc => acc.fn('$total', Aggregate.Sum, '$tx.amount'),
    )
    expect(lhs._conditions[0]).toMatchObject({ kind: 'Accumulate' })
  })

  it('.from() creates a FromCondition', () => {
    const lhs = new LHSBuilder().from('Transaction', '$tx', '$list')
    expect(lhs._conditions[0]).toMatchObject({ kind: 'From', expression: '$list' })
  })

  it('.eval() creates an EvalCondition', () => {
    const lhs = new LHSBuilder().eval('x > 0')
    expect(lhs._conditions[0]).toEqual({ kind: 'Eval', expression: 'x > 0' })
  })

  it('.raw() creates a RawCondition', () => {
    const lhs = new LHSBuilder().raw('some raw drl')
    expect(lhs._conditions[0]).toEqual({ kind: 'RawCondition', drl: 'some raw drl' })
  })

  it('accumulates multiple conditions', () => {
    const lhs = new LHSBuilder()
      .fact('Player', '$p')
      .not(b => b.fact('Alert'))
      .eval('x > 0')
    expect(lhs._conditions).toHaveLength(3)
  })
})

// ─── RHSBuilder ───────────────────────────────────────────────────────────────

describe('RHSBuilder', () => {
  it('.modify() creates a ModifyConsequence', () => {
    const rhs = new RHSBuilder().modify('$p', m => m.call('setScore', '200'))
    expect(rhs._consequences[0]).toMatchObject({ kind: 'ModifyConsequence', binding: '$p' })
  })

  it('.insert() creates an InsertConsequence', () => {
    const rhs = new RHSBuilder().insert('new Alert()')
    expect(rhs._consequences[0]).toEqual({ kind: 'InsertConsequence', objectExpression: 'new Alert()' })
  })

  it('.retract() creates a RetractConsequence', () => {
    const rhs = new RHSBuilder().retract('$p')
    expect(rhs._consequences[0]).toEqual({ kind: 'RetractConsequence', binding: '$p' })
  })

  it('.global() creates a SetGlobalConsequence', () => {
    const rhs = new RHSBuilder().global('service.notify()')
    expect(rhs._consequences[0]).toEqual({ kind: 'SetGlobalConsequence', expression: 'service.notify()' })
  })

  it('.raw() creates a RawConsequence', () => {
    const rhs = new RHSBuilder().raw('System.out.println("hi")')
    expect(rhs._consequences[0]).toEqual({ kind: 'RawConsequence', code: 'System.out.println("hi")' })
  })

  it('accumulates multiple consequences', () => {
    const rhs = new RHSBuilder()
      .insert('new Alert()')
      .retract('$p')
      .raw('log.info("done")')
    expect(rhs._consequences).toHaveLength(3)
  })
})

// ─── RuleBuilder ──────────────────────────────────────────────────────────────

describe('RuleBuilder', () => {
  it('createRule() initialises with the given name', () => {
    const rule = createRule('My Rule').build()
    expect(rule.name).toBe('My Rule')
    expect(rule.conditions).toEqual([])
    expect(rule.consequences).toEqual([])
  })

  it('sets salience', () => {
    const rule = createRule('R').salience(10).build()
    expect(rule.salience).toBe(10)
  })

  it('sets agendaGroup', () => {
    const rule = createRule('R').agendaGroup('group1').build()
    expect(rule.agendaGroup).toBe('group1')
  })

  it('sets noLoop (defaults to true)', () => {
    const rule = createRule('R').noLoop().build()
    expect(rule.noLoop).toBe(true)
  })

  it('sets noLoop explicitly false', () => {
    const rule = createRule('R').noLoop(false).build()
    expect(rule.noLoop).toBe(false)
  })

  it('sets lockOnActive (defaults to true)', () => {
    const rule = createRule('R').lockOnActive().build()
    expect(rule.lockOnActive).toBe(true)
  })

  it('sets ruleFlowGroup', () => {
    const rule = createRule('R').ruleFlowGroup('flow1').build()
    expect(rule.ruleFlowGroup).toBe('flow1')
  })

  it('.addCondition() accepts a plain Condition object', () => {
    const rule = createRule('R')
      .addCondition({ kind: 'FactPattern', factType: 'Player', constraints: [] })
      .build()
    expect(rule.conditions).toHaveLength(1)
    expect(rule.conditions[0].kind).toBe('FactPattern')
  })

  it('.addCondition() accepts a PatternBuilder and auto-resolves it', () => {
    const rule = createRule('R')
      .addCondition(new PatternBuilder('Player', '$p').field('score', Operator.Gte, '100'))
      .build()
    expect(rule.conditions[0]).toMatchObject({ kind: 'FactPattern', factType: 'Player' })
  })

  it('.addConsequence() accepts a plain Consequence object', () => {
    const rule = createRule('R')
      .addConsequence({ kind: 'InsertConsequence', objectExpression: 'new Alert()' })
      .build()
    expect(rule.consequences[0]).toMatchObject({ kind: 'InsertConsequence' })
  })

  it('.addConsequence() accepts a ModifyBuilder and auto-resolves it', () => {
    const rule = createRule('R')
      .addConsequence(new ModifyBuilder('$p').call('setScore', '0'))
      .build()
    expect(rule.consequences[0]).toMatchObject({ kind: 'ModifyConsequence' })
  })

  it('.when() callback appends conditions', () => {
    const rule = createRule('R')
      .when(lhs => { lhs.fact('Player', '$p') })
      .build()
    expect(rule.conditions).toHaveLength(1)
  })

  it('.then() callback appends consequences', () => {
    const rule = createRule('R')
      .then(rhs => { rhs.insert('new Alert()') })
      .build()
    expect(rule.consequences).toHaveLength(1)
  })

  it('mixes .addCondition() and .when()', () => {
    const rule = createRule('R')
      .addCondition({ kind: 'Eval' as const, expression: 'x > 0' })
      .when(lhs => { lhs.fact('Player', '$p') })
      .build()
    expect(rule.conditions).toHaveLength(2)
  })

  it('.build() returns a copy — mutating the builder does not affect the built rule', () => {
    const builder = createRule('R').salience(1)
    const rule1 = builder.build()
    builder.salience(99)
    const rule2 = builder.build()
    expect(rule1.salience).toBe(1)
    expect(rule2.salience).toBe(99)
  })
})
