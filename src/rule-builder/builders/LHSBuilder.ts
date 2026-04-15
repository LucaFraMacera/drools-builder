import type {
  Condition,
  UnboundPattern,
  EvalCondition,
  RawCondition,
} from '../metamodel/types'
import { PatternBuilder, UnboundPatternBuilder } from './PatternBuilder'
import { AccumulateBuilder } from './AccumulateBuilder'

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Restricted builder for the inner condition of not() and exists().
 * Drools only allows UnboundPattern, eval(), or raw DRL inside these wrappers.
 */
class InnerPatternBuilder {
  private _inner?: UnboundPattern | EvalCondition | RawCondition

  fact(factType: string, fn?: (p: UnboundPatternBuilder) => void): this {
    const b = new UnboundPatternBuilder(factType)
    fn?.(b)
    this._inner = b.build()
    return this
  }

  eval(expression: string): this {
    this._inner = { kind: 'Eval', expression }
    return this
  }

  raw(drl: string): this {
    this._inner = { kind: 'RawCondition', drl }
    return this
  }

  /** @internal */
  _build(): UnboundPattern | EvalCondition | RawCondition {
    if (!this._inner) throw new Error('not() / exists() block requires at least one condition')
    return this._inner
  }
}

// ─── LHSBuilder ───────────────────────────────────────────────────────────────

/**
 * Imperative builder for the when-block of a rule.
 * Obtained via RuleBuilder.when(lhs => { ... }).
 *
 * Every method returns `this` for optional chaining.
 */
export class LHSBuilder {
  /** @internal collected conditions — consumed by RuleBuilder */
  readonly _conditions: Condition[] = []

  // ── Fact patterns ──────────────────────────────────────────────────────────

  /** Add a FactPattern with an optional variable binding. */
  fact(factType: string, binding: string, fn?: (p: PatternBuilder) => void): this
  fact(factType: string, fn?: (p: PatternBuilder) => void): this
  fact(
    factType: string,
    bindingOrFn?: string | ((p: PatternBuilder) => void),
    fn?: (p: PatternBuilder) => void,
  ): this {
    let binding: string | undefined
    let configureFn: ((p: PatternBuilder) => void) | undefined

    if (typeof bindingOrFn === 'string') {
      binding     = bindingOrFn
      configureFn = fn
    } else {
      configureFn = bindingOrFn
    }

    const builder = new PatternBuilder(factType, binding)
    configureFn?.(builder)
    this._conditions.push(builder.build())
    return this
  }

  // ── Logical wrappers ───────────────────────────────────────────────────────

  /** Add a not() wrapper. Inner condition must be unbound (no variable binding). */
  not(fn: (b: InnerPatternBuilder) => void): this {
    const b = new InnerPatternBuilder()
    fn(b)
    this._conditions.push({ kind: 'Not', condition: b._build() })
    return this
  }

  /** Add an exists() wrapper. Inner condition must be unbound. */
  exists(fn: (b: InnerPatternBuilder) => void): this {
    const b = new InnerPatternBuilder()
    fn(b)
    this._conditions.push({ kind: 'Exists', condition: b._build() })
    return this
  }

  /** Add an or() group. Each child is added via the nested LHSBuilder. */
  or(fn: (lhs: LHSBuilder) => void): this {
    const inner = new LHSBuilder()
    fn(inner)
    this._conditions.push({ kind: 'Or', conditions: inner._conditions })
    return this
  }

  /** Add an and() group. Useful when composing nested boolean logic. */
  and(fn: (lhs: LHSBuilder) => void): this {
    const inner = new LHSBuilder()
    fn(inner)
    this._conditions.push({ kind: 'And', conditions: inner._conditions })
    return this
  }

  /** Add a forall() wrapper. */
  forall(fn: (lhs: LHSBuilder) => void): this {
    const inner = new LHSBuilder()
    fn(inner)
    const condition: Condition =
      inner._conditions.length === 1
        ? inner._conditions[0]
        : { kind: 'And', conditions: inner._conditions }
    this._conditions.push({ kind: 'Forall', condition })
    return this
  }

  // ── Accumulate ─────────────────────────────────────────────────────────────

  /**
   * Add an accumulate pattern.
   * @param sourceFn - builds the source condition (the pattern being accumulated)
   * @param fn       - configures the accumulate functions and result constraint
   */
  accumulate(
    sourceFn: (lhs: LHSBuilder) => void,
    fn: (acc: AccumulateBuilder) => void,
  ): this {
    const sourceLhs = new LHSBuilder()
    sourceFn(sourceLhs)
    const source: Condition =
      sourceLhs._conditions.length === 1
        ? sourceLhs._conditions[0]
        : { kind: 'And', conditions: sourceLhs._conditions }
    const acc = new AccumulateBuilder(source)
    fn(acc)
    this._conditions.push(acc.build())
    return this
  }

  // ── From ───────────────────────────────────────────────────────────────────

  /**
   * Add a from condition: FactType( constraints ) from expression
   * @param factType   - the type to match
   * @param binding    - variable binding for the matched fact
   * @param expression - the source expression (collection, method call, etc.)
   * @param fn         - optional constraint configuration
   */
  from(
    factType: string,
    binding: string,
    expression: string,
    fn?: (p: PatternBuilder) => void,
  ): this {
    const builder = new PatternBuilder(factType, binding)
    fn?.(builder)
    this._conditions.push({ kind: 'From', pattern: builder.build(), expression })
    return this
  }

  // ── Primitives ─────────────────────────────────────────────────────────────

  /** Add an eval() condition with a raw boolean expression. */
  eval(expression: string): this {
    this._conditions.push({ kind: 'Eval', expression })
    return this
  }

  /** Add a verbatim DRL condition, emitted as-is. */
  raw(drl: string): this {
    this._conditions.push({ kind: 'RawCondition', drl })
    return this
  }
}
