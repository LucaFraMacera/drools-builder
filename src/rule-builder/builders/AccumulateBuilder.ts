import type { AccumulatePattern, AccumulateFunction, Condition } from '../metamodel/types'
import type { Aggregate } from './enums'

/**
 * Chainable builder for an AccumulatePattern.
 *
 * Create via the accumulate() factory function:
 *
 *   accumulate(fact('Transaction', '$tx').field('amount', Operator.Gt, '0'))
 *     .fn('$total', Aggregate.Sum, '$tx.amount')
 *     .resultConstraint('$total > 1000')
 */
export class AccumulateBuilder {
  private readonly _source: Condition
  private readonly _functions: AccumulateFunction[] = []
  private _resultConstraint?: string

  constructor(source: Condition) {
    this._source = source
  }

  /**
   * Register an accumulate function.
   * @param binding   - the variable the result is bound to, e.g. '$total'
   * @param func      - function name or Aggregate enum, e.g. Aggregate.Sum / 'collectList'
   * @param argument  - the argument expression, e.g. '$tx.amount'
   */
  fn(binding: string, func: Aggregate | string, argument: string): this {
    this._functions.push({ binding, function: func, argument })
    return this
  }

  /** Optional result constraint applied to the accumulated value, e.g. '$total > 50' */
  resultConstraint(expression: string): this {
    this._resultConstraint = expression
    return this
  }

  build(): AccumulatePattern {
    return {
      kind: 'Accumulate',
      source: this._source,
      functions: [...this._functions],
      ...(this._resultConstraint !== undefined
        ? { resultConstraint: this._resultConstraint }
        : {}),
    }
  }
}
