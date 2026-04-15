import type { DroolsFile, Rule } from '../metamodel/types'
import { RuleBuilder } from './RuleBuilder'

interface Buildable<T> { build(): T }

function resolveRule(input: Rule | Buildable<Rule>): Rule {
  return typeof (input as Buildable<Rule>).build === 'function'
    ? (input as Buildable<Rule>).build()
    : (input as Rule)
}

/**
 * Chainable builder for a DroolsFile (a collection of rules with shared imports).
 *
 * Create via the createFile() factory:
 *
 *   createFile('fraud-rules')
 *     .import('com.example.model.Account')
 *     .import('com.example.model.FraudAlert')
 *     .addRule(
 *       createRule('Detect Fraud').when(...).then(...),
 *     )
 *     .build()
 */
export class DroolsFileBuilder {
  private readonly _name: string
  private readonly _imports: string[] = []
  private readonly _rules: Rule[] = []

  constructor(name: string) {
    this._name = name
  }

  /**
   * Add a fully-qualified Java class import.
   * Can be called multiple times — order is preserved.
   *
   * @example
   *   .import('com.example.model.Player')
   */
  import(className: string): this {
    this._imports.push(className)
    return this
  }

  /**
   * Add a rule to the file.
   * Accepts a plain Rule object or a RuleBuilder (auto-resolved via .build()).
   *
   * @example
   *   .addRule(createRule('My Rule').when(...).then(...))
   *   .addRule({ name: 'My Rule', conditions: [], consequences: [] })
   */
  addRule(rule: Rule | RuleBuilder): this {
    this._rules.push(resolveRule(rule))
    return this
  }

  build(): DroolsFile {
    return {
      name: this._name,
      imports: [...this._imports],
      rules: [...this._rules],
    }
  }
}

/** Create a new DroolsFileBuilder with the given file name. */
export function createFile(name: string): DroolsFileBuilder {
  return new DroolsFileBuilder(name)
}
