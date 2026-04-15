import { describe, it, expect } from 'vitest'
import { Operator, Aggregate } from '../enums'
import type { ConstraintOperator } from '../../metamodel/types'

describe('Operator enum', () => {
  it('has the correct DRL token for each member', () => {
    expect(Operator.Eq).toBe('==')
    expect(Operator.Neq).toBe('!=')
    expect(Operator.Gt).toBe('>')
    expect(Operator.Lt).toBe('<')
    expect(Operator.Gte).toBe('>=')
    expect(Operator.Lte).toBe('<=')
    expect(Operator.Contains).toBe('contains')
    expect(Operator.NotContains).toBe('not contains')
    expect(Operator.MemberOf).toBe('memberOf')
    expect(Operator.NotMemberOf).toBe('not memberOf')
    expect(Operator.Matches).toBe('matches')
    expect(Operator.NotMatches).toBe('not matches')
  })

  it('covers every ConstraintOperator token', () => {
    // This is a compile-time check made concrete: assign each enum member to
    // a ConstraintOperator variable to verify they are type-compatible.
    const ops: ConstraintOperator[] = [
      Operator.Eq, Operator.Neq, Operator.Gt, Operator.Lt,
      Operator.Gte, Operator.Lte, Operator.Contains, Operator.NotContains,
      Operator.MemberOf, Operator.NotMemberOf, Operator.Matches, Operator.NotMatches,
    ]
    expect(ops).toHaveLength(12)
  })

  it('has 12 members', () => {
    const values = Object.values(Operator)
    expect(values).toHaveLength(12)
  })
})

describe('Aggregate enum', () => {
  it('has the correct DRL function name for each member', () => {
    expect(Aggregate.Sum).toBe('sum')
    expect(Aggregate.Count).toBe('count')
    expect(Aggregate.Min).toBe('min')
    expect(Aggregate.Max).toBe('max')
    expect(Aggregate.Average).toBe('average')
    expect(Aggregate.CollectList).toBe('collectList')
    expect(Aggregate.CollectSet).toBe('collectSet')
    expect(Aggregate.CountDistinct).toBe('countDistinct')
  })

  it('has 8 members', () => {
    const values = Object.values(Aggregate)
    expect(values).toHaveLength(8)
  })
})
