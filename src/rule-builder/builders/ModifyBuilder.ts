import type { ModifyConsequence, Modification } from '../metamodel/types'

/**
 * Chainable builder for a ModifyConsequence.
 *
 * Create via the modify() factory function:
 *
 *   modify('$account')
 *     .call('setStatus', 'Account.Status.FROZEN')
 *     .call('setRemarks', '"Frozen by rule"')
 */
export class ModifyBuilder {
  private readonly _binding: string
  private readonly _modifications: Modification[] = []

  constructor(binding: string) {
    this._binding = binding
  }

  /** Call a setter/method on the bound fact with the given arguments. */
  call(method: string, ...args: string[]): this {
    this._modifications.push({ method, args })
    return this
  }

  build(): ModifyConsequence {
    return {
      kind: 'ModifyConsequence',
      binding: this._binding,
      modifications: [...this._modifications],
    }
  }
}
