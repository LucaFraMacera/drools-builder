import type { FactPattern, UnboundPattern, Constraint, ConstraintOperator } from '../metamodel/types'

// ─── FactPattern builder ──────────────────────────────────────────────────────

/**
 * Chainable builder for a FactPattern (a bound or unbound pattern in the LHS).
 *
 * Create via the fact() factory function:
 *   fact('Player', '$p').field('score', Operator.Gte, '100')
 */
export class PatternBuilder {
  private readonly _factType: string
  private readonly _binding: string | undefined
  private readonly _constraints: Constraint[] = []

  constructor(factType: string, binding?: string) {
    this._factType = factType
    this._binding  = binding
  }

  /**
   * Add a field constraint: field operator value.
   * Optionally binds the result to a variable: $v : field op value.
   */
  field(field: string, operator: ConstraintOperator, value: string, binding?: string): this {
    const constraint: Constraint = binding
      ? { kind: 'FieldConstraint', field, operator, value, binding }
      : { kind: 'FieldConstraint', field, operator, value }
    this._constraints.push(constraint)
    return this
  }

  /** Bind a field to a variable: $binding : field */
  bind(binding: string, field: string): this {
    this._constraints.push({ kind: 'BindingConstraint', binding, field })
    return this
  }

  /** Emit a verbatim DRL constraint expression. */
  raw(expression: string): this {
    this._constraints.push({ kind: 'RawConstraint', expression })
    return this
  }

  build(): FactPattern {
    return {
      kind: 'FactPattern',
      factType: this._factType,
      ...(this._binding !== undefined ? { binding: this._binding } : {}),
      constraints: [...this._constraints],
    }
  }
}

// ─── UnboundPattern builder ───────────────────────────────────────────────────

/**
 * Chainable builder for an UnboundPattern (used inside not() and exists()
 * where Drools forbids variable bindings).
 *
 * Create via the unbound() factory function:
 *   not(unbound('FraudAlert').field('status', Operator.Eq, '"UNRESOLVED"'))
 */
export class UnboundPatternBuilder {
  private readonly _factType: string
  private readonly _constraints: Constraint[] = []

  constructor(factType: string) {
    this._factType = factType
  }

  field(field: string, operator: ConstraintOperator, value: string): this {
    this._constraints.push({ kind: 'FieldConstraint', field, operator, value })
    return this
  }

  raw(expression: string): this {
    this._constraints.push({ kind: 'RawConstraint', expression })
    return this
  }

  build(): UnboundPattern {
    return {
      kind: 'UnboundPattern',
      factType: this._factType,
      constraints: [...this._constraints],
    }
  }
}
