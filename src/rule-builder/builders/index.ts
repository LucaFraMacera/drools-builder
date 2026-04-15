/**
 * drools-builder — public API
 *
 * Import from this module to access both the metamodel types and the builder API.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────
export { Operator, Aggregate } from './enums'

// ─── Builder classes (for advanced use / extension) ───────────────────────────
export { PatternBuilder, UnboundPatternBuilder } from './PatternBuilder'
export { AccumulateBuilder }                      from './AccumulateBuilder'
export { ModifyBuilder }                          from './ModifyBuilder'
export { LHSBuilder }                             from './LHSBuilder'
export { RHSBuilder }                             from './RHSBuilder'
export { RuleBuilder, createRule }                from './RuleBuilder'
export { DroolsFileBuilder, createFile }          from './DroolsFileBuilder'

// ─── Metamodel types (re-exported for convenience) ───────────────────────────
export type {
  ConstraintOperator,
  Constraint,
  FieldConstraint,
  BindingConstraint,
  RawConstraint,
  FactType,
  FactPattern,
  UnboundPattern,
  AndCondition,
  OrCondition,
  NotCondition,
  ExistsCondition,
  ForallCondition,
  AccumulateFunction,
  AccumulatePattern,
  FromCondition,
  EvalCondition,
  RawCondition,
  Condition,
  Modification,
  ModifyConsequence,
  InsertConsequence,
  RetractConsequence,
  SetGlobalConsequence,
  RawConsequence,
  Consequence,
  Rule,
  DroolsFile,
} from '../metamodel/types'

// ─── Internal imports for factory implementations ─────────────────────────────
import type {
  Condition,
  UnboundPattern,
  EvalCondition,
  RawCondition,
  NotCondition,
  ExistsCondition,
  OrCondition,
  AndCondition,
  ForallCondition,
  AccumulatePattern,
  FromCondition,
  InsertConsequence,
  RetractConsequence,
  SetGlobalConsequence,
  RawConsequence,
} from '../metamodel/types'
import { PatternBuilder, UnboundPatternBuilder } from './PatternBuilder'
import { AccumulateBuilder }                      from './AccumulateBuilder'
import { ModifyBuilder }                          from './ModifyBuilder'

// ─── Shared resolver ──────────────────────────────────────────────────────────

interface Buildable<T> { build(): T }

function resolveCondition(
  input: Condition | Buildable<Condition>,
): Condition {
  return typeof (input as Buildable<Condition>).build === 'function'
    ? (input as Buildable<Condition>).build()
    : (input as Condition)
}

type NotExistsInput =
  | UnboundPattern
  | EvalCondition
  | RawCondition
  | Buildable<UnboundPattern>

function resolveNotExists(
  input: NotExistsInput,
): UnboundPattern | EvalCondition | RawCondition {
  return typeof (input as Buildable<UnboundPattern>).build === 'function'
    ? (input as Buildable<UnboundPattern>).build()
    : (input as UnboundPattern | EvalCondition | RawCondition)
}

// ─── Condition factories ──────────────────────────────────────────────────────

/**
 * Start building a FactPattern.
 *
 * @param factType - the Java class name to match (e.g. 'Player')
 * @param binding  - optional variable binding (e.g. '$p')
 *
 * @example
 *   fact('Player', '$p').field('score', Operator.Gte, '100')
 */
export function fact(factType: string, binding?: string): PatternBuilder {
  return new PatternBuilder(factType, binding)
}

/**
 * Start building an UnboundPattern for use inside not() or exists().
 *
 * @example
 *   not(unbound('FraudAlert').field('status', Operator.Eq, '"UNRESOLVED"'))
 */
export function unbound(factType: string): UnboundPatternBuilder {
  return new UnboundPatternBuilder(factType)
}

/**
 * Wrap a condition in a Drools not().
 * The inner condition must be unbound (UnboundPatternBuilder / UnboundPattern),
 * an eval(), or a raw condition.
 */
export function not(condition: NotExistsInput): NotCondition {
  return { kind: 'Not', condition: resolveNotExists(condition) }
}

/**
 * Wrap a condition in a Drools exists().
 * Same constraints as not().
 */
export function exists(condition: NotExistsInput): ExistsCondition {
  return { kind: 'Exists', condition: resolveNotExists(condition) }
}

/**
 * Group conditions with OR semantics.
 *
 * @example
 *   or(fact('A').field('x', Operator.Eq, '1'), fact('B').field('y', Operator.Eq, '2'))
 */
export function or(...conditions: Array<Condition | Buildable<Condition>>): OrCondition {
  return { kind: 'Or', conditions: conditions.map(resolveCondition) }
}

/**
 * Group conditions with AND semantics.
 * Mostly used when building nested boolean logic inside or().
 */
export function and(...conditions: Array<Condition | Buildable<Condition>>): AndCondition {
  return { kind: 'And', conditions: conditions.map(resolveCondition) }
}

/**
 * Wrap a condition in a Drools forall().
 *
 * @example
 *   forall(fact('Transaction', '$tx').field('validated', Operator.Eq, 'true'))
 */
export function forall(condition: Condition | Buildable<Condition>): ForallCondition {
  return { kind: 'Forall', condition: resolveCondition(condition) }
}

/**
 * Start building an AccumulatePattern.
 *
 * @example
 *   accumulate(fact('Transaction', '$tx').field('amount', Operator.Gt, '0'))
 *     .fn('$total', Aggregate.Sum, '$tx.amount')
 *     .resultConstraint('$total > 1000')
 */
export function accumulate(
  source: Condition | Buildable<Condition>,
): AccumulateBuilder {
  return new AccumulateBuilder(resolveCondition(source))
}

/**
 * Build a FromCondition: pattern from expression.
 *
 * @example
 *   from_(fact('Transaction', '$tx'), '$recentTxs')
 */
export function from_(
  pattern: PatternBuilder,
  expression: string,
): FromCondition {
  return { kind: 'From', pattern: pattern.build(), expression }
}

/**
 * Build an EvalCondition with a raw boolean expression.
 *
 * @example
 *   eval_('$p.getScore() > threshold')
 */
export function eval_(expression: string): EvalCondition {
  return { kind: 'Eval', expression }
}

/**
 * Build a RawCondition — verbatim DRL, emitted as-is.
 * Use as an escape hatch for constructs not covered by the builder.
 */
export function rawCondition(drl: string): RawCondition {
  return { kind: 'RawCondition', drl }
}

// ─── Consequence factories ────────────────────────────────────────────────────

/**
 * Start building a ModifyConsequence.
 *
 * @example
 *   modify('$account').call('setStatus', 'Account.Status.FROZEN')
 */
export function modify(binding: string): ModifyBuilder {
  return new ModifyBuilder(binding)
}

/**
 * Build an InsertConsequence — inserts a new fact into working memory.
 *
 * @example
 *   insert('new FraudAlert()')
 */
export function insert(objectExpression: string): InsertConsequence {
  return { kind: 'InsertConsequence', objectExpression }
}

/**
 * Build a RetractConsequence — removes a fact from working memory.
 *
 * @example
 *   retract('$obsoleteAlert')
 */
export function retract(binding: string): RetractConsequence {
  return { kind: 'RetractConsequence', binding }
}

/**
 * Build a SetGlobalConsequence — assign a value to a global variable.
 *
 * @example
 *   setGlobal('alertService.notify($account)')
 */
export function setGlobal(expression: string): SetGlobalConsequence {
  return { kind: 'SetGlobalConsequence', expression }
}

/**
 * Build a RawConsequence — verbatim Java/DRL code, emitted as-is.
 * Use as an escape hatch for logic not covered by the builder.
 */
export function rawConsequence(code: string): RawConsequence {
  return { kind: 'RawConsequence', code }
}
