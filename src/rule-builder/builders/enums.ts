/**
 * Typed enum for every constraint operator supported by Drools.
 * Values are the exact DRL tokens, so an Operator member is directly
 * assignable to the ConstraintOperator string-literal union in types.ts.
 *
 * @example
 *   fact('Player', '$p').field('score', Operator.Gte, '100')
 */
export enum Operator {
  Eq           = '==',
  Neq          = '!=',
  Gt           = '>',
  Lt           = '<',
  Gte          = '>=',
  Lte          = '<=',
  Contains     = 'contains',
  NotContains  = 'not contains',
  MemberOf     = 'memberOf',
  NotMemberOf  = 'not memberOf',
  Matches      = 'matches',
  NotMatches   = 'not matches',
}

/**
 * Typed enum for the built-in Drools accumulate functions.
 * Use these as the second argument to AccumulateBuilder.fn().
 *
 * @example
 *   accumulate(fact('Transaction', '$tx'))
 *     .fn('$total', Aggregate.Sum, '$tx.amount')
 */
export enum Aggregate {
  Sum           = 'sum',
  Count         = 'count',
  Min           = 'min',
  Max           = 'max',
  Average       = 'average',
  CollectList   = 'collectList',
  CollectSet    = 'collectSet',
  CountDistinct = 'countDistinct',
}
