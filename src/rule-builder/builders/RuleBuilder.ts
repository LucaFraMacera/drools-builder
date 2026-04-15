import type { Rule, Condition, Consequence } from '../metamodel/types'
import { LHSBuilder } from './LHSBuilder'
import { RHSBuilder } from './RHSBuilder'

interface Buildable<T> {
  build(): T
}

function resolveCondition(input: Condition | Buildable<Condition>): Condition {
  return typeof (input as Buildable<Condition>).build === 'function'
    ? (input as Buildable<Condition>).build()
    : (input as Condition)
}

function resolveConsequence(input: Consequence | Buildable<Consequence>): Consequence {
  return typeof (input as Buildable<Consequence>).build === 'function'
    ? (input as Buildable<Consequence>).build()
    : (input as Consequence)
}

/**
 * Fluent builder for a Drools Rule.
 *
 * Entry point: createRule(name)
 *
 * Two usage styles are supported and can be freely mixed:
 *
 * Style 1 — factory functions (composable, works well for complex rules):
 *   createRule('Award Badge')
 *     .salience(10)
 *     .addCondition(fact('Player', '$p').field('score', Operator.Gte, '100'))
 *     .addConsequence(modify('$p').call('awardBadge', '"gold"'))
 *     .build()
 *
 * Style 2 — callback blocks (mirrors DRL when/then structure):
 *   createRule('Award Badge')
 *     .salience(10)
 *     .when(lhs => {
 *       lhs.fact('Player', '$p', p => p.field('score', Operator.Gte, '100'))
 *     })
 *     .then(rhs => {
 *       rhs.modify('$p', m => m.call('awardBadge', '"gold"'))
 *     })
 *     .build()
 *
 * Plain metamodel objects are also accepted everywhere a builder is expected,
 * so hand-crafted conditions/consequences can be mixed freely with builders.
 */
export class RuleBuilder {
  private readonly _rule: Rule

  constructor(name: string) {
    this._rule = { name, conditions: [], consequences: [] }
  }

  // ── Rule attributes ────────────────────────────────────────────────────────

  salience(value: number): this {
    this._rule.salience = value
    return this
  }

  agendaGroup(value: string): this {
    this._rule.agendaGroup = value
    return this
  }

  /** Defaults to true when called without an argument. */
  noLoop(value = true): this {
    this._rule.noLoop = value
    return this
  }

  /** Defaults to true when called without an argument. */
  lockOnActive(value = true): this {
    this._rule.lockOnActive = value
    return this
  }

  ruleFlowGroup(value: string): this {
    this._rule.ruleFlowGroup = value
    return this
  }

  // ── Step-by-step style ─────────────────────────────────────────────────────

  /**
   * Append a single condition.
   * Accepts a plain Condition object or any builder that exposes build().
   */
  addCondition(condition: Condition | Buildable<Condition>): this {
    this._rule.conditions.push(resolveCondition(condition))
    return this
  }

  /**
   * Append a single consequence.
   * Accepts a plain Consequence object or any builder that exposes build().
   */
  addConsequence(consequence: Consequence | Buildable<Consequence>): this {
    this._rule.consequences.push(resolveConsequence(consequence))
    return this
  }

  // ── Callback block style ───────────────────────────────────────────────────

  /** Configure the when-block using an LHSBuilder. Appends to existing conditions. */
  when(fn: (lhs: LHSBuilder) => void): this {
    const lhs = new LHSBuilder()
    fn(lhs)
    this._rule.conditions.push(...lhs._conditions)
    return this
  }

  /** Configure the then-block using an RHSBuilder. Appends to existing consequences. */
  then(fn: (rhs: RHSBuilder) => void): this {
    const rhs = new RHSBuilder()
    fn(rhs)
    this._rule.consequences.push(...rhs._consequences)
    return this
  }

  // ── Terminal ───────────────────────────────────────────────────────────────

  build(): Rule {
    return {
      ...this._rule,
      conditions:   [...this._rule.conditions],
      consequences: [...this._rule.consequences],
    }
  }
}

/** Create a new RuleBuilder for a rule with the given name. */
export function createRule(name: string): RuleBuilder {
  return new RuleBuilder(name)
}
