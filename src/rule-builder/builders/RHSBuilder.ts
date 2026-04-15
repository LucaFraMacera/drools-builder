import type { Consequence } from '../metamodel/types'
import { ModifyBuilder } from './ModifyBuilder'

/**
 * Imperative builder for the then-block of a rule.
 * Obtained via RuleBuilder.then(rhs => { ... }).
 */
export class RHSBuilder {
  /** @internal collected consequences — consumed by RuleBuilder */
  readonly _consequences: Consequence[] = []

  /** modify($binding) { ... } — calls setters on an existing fact. */
  modify(binding: string, fn: (m: ModifyBuilder) => void): this {
    const builder = new ModifyBuilder(binding)
    fn(builder)
    this._consequences.push(builder.build())
    return this
  }

  /** insert(objectExpression) — inserts a new fact into working memory. */
  insert(objectExpression: string): this {
    this._consequences.push({ kind: 'InsertConsequence', objectExpression })
    return this
  }

  /** retract($binding) — removes a fact from working memory. */
  retract(binding: string): this {
    this._consequences.push({ kind: 'RetractConsequence', binding })
    return this
  }

  /** Assign a value to a global variable. */
  global(expression: string): this {
    this._consequences.push({ kind: 'SetGlobalConsequence', expression })
    return this
  }

  /** Emit a verbatim DRL statement, emitted as-is. */
  raw(code: string): this {
    this._consequences.push({ kind: 'RawConsequence', code })
    return this
  }
}
