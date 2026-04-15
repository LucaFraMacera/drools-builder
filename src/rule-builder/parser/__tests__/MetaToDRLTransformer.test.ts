import { describe, it, expect } from 'vitest'
import { MetaToDRLTransformer } from '../MetaToDRLTransformer'
import { Operator, Aggregate } from '../../builders/enums'
import type { Rule, DroolsFile, Condition, Consequence } from '../../metamodel/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ruleWith(conditions: Condition[], consequences: Consequence[] = []): Rule {
  return { name: 'Test', conditions, consequences }
}

function generate(conditions: Condition[], consequences: Consequence[] = []): string {
  return MetaToDRLTransformer.generateRule(ruleWith(conditions, consequences))
}

// ─── Constraint generation ────────────────────────────────────────────────────

describe('MetaToDRLTransformer — constraints', () => {
  it('generates a FieldConstraint', () => {
    const drl = generate([{
      kind: 'FactPattern', factType: 'Player', binding: '$p',
      constraints: [{ kind: 'FieldConstraint', field: 'score', operator: Operator.Gte, value: '100' }],
    }])
    expect(drl).toContain(`score ${Operator.Gte} 100`)
  })

  it('generates a FieldConstraint with result binding', () => {
    const drl = generate([{
      kind: 'FactPattern', factType: 'Player', binding: '$p',
      constraints: [{ kind: 'FieldConstraint', field: 'score', operator: Operator.Gte, value: '100', binding: '$sc' }],
    }])
    expect(drl).toContain(`$sc : score ${Operator.Gte} 100`)
  })

  it('generates a BindingConstraint', () => {
    const drl = generate([{
      kind: 'FactPattern', factType: 'Player', binding: '$p',
      constraints: [{ kind: 'BindingConstraint', binding: '$id', field: 'id' }],
    }])
    expect(drl).toContain('$id : id')
  })

  it('generates a RawConstraint verbatim', () => {
    const drl = generate([{
      kind: 'FactPattern', factType: 'Player', binding: '$p',
      constraints: [{ kind: 'RawConstraint', expression: 'score > threshold && active' }],
    }])
    expect(drl).toContain('score > threshold && active')
  })
})

// ─── Condition generation ─────────────────────────────────────────────────────

describe('MetaToDRLTransformer — FactPattern', () => {
  it('generates binding and type', () => {
    const drl = generate([{ kind: 'FactPattern', factType: 'Player', binding: '$p', constraints: [] }])
    expect(drl).toContain('$p : Player(  )')
  })

  it('generates without binding', () => {
    const drl = generate([{ kind: 'FactPattern', factType: 'Player', constraints: [] }])
    expect(drl).toContain('Player(  )')
    expect(drl).not.toContain('undefined')
  })
})

describe('MetaToDRLTransformer — NotCondition', () => {
  it('generates not()', () => {
    const drl = generate([{
      kind: 'Not',
      condition: { kind: 'UnboundPattern', factType: 'FraudAlert', constraints: [] },
    }])
    expect(drl).toContain('not( FraudAlert(  ) )')
  })
})

describe('MetaToDRLTransformer — ExistsCondition', () => {
  it('generates exists()', () => {
    const drl = generate([{
      kind: 'Exists',
      condition: { kind: 'UnboundPattern', factType: 'Alert', constraints: [] },
    }])
    expect(drl).toContain('exists( Alert(  ) )')
  })
})

describe('MetaToDRLTransformer — OrCondition', () => {
  it('generates an or group', () => {
    const drl = generate([{
      kind: 'Or',
      conditions: [
        { kind: 'FactPattern', factType: 'A', constraints: [] },
        { kind: 'FactPattern', factType: 'B', constraints: [] },
      ],
    }])
    expect(drl).toContain('or')
    expect(drl).toContain('A(  )')
    expect(drl).toContain('B(  )')
  })
})

describe('MetaToDRLTransformer — AndCondition', () => {
  it('at the top level, a single AndCondition is transparently unrolled into individual lines', () => {
    // generateWhenBlock flattens a top-level AndCondition — AND is implicit at the rule level
    const drl = generate([{
      kind: 'And',
      conditions: [
        { kind: 'FactPattern', factType: 'A', constraints: [] },
        { kind: 'FactPattern', factType: 'B', constraints: [] },
      ],
    }])
    expect(drl).toContain('A(  )')
    expect(drl).toContain('B(  )')
    // The word 'and' is NOT emitted — conditions are separated by newlines
    expect(drl).not.toContain(' and ')
  })

  it('when nested inside an Or, generates an explicit ( ... and ... ) group', () => {
    const drl = generate([{
      kind: 'Or',
      conditions: [
        {
          kind: 'And',
          conditions: [
            { kind: 'FactPattern', factType: 'A', constraints: [] },
            { kind: 'FactPattern', factType: 'B', constraints: [] },
          ],
        },
        { kind: 'FactPattern', factType: 'C', constraints: [] },
      ],
    }])
    expect(drl).toContain('and')
    expect(drl).toContain('A(  )')
    expect(drl).toContain('B(  )')
  })
})

describe('MetaToDRLTransformer — AccumulatePattern', () => {
  it('generates accumulate with function and result constraint', () => {
    const drl = generate([{
      kind: 'Accumulate',
      source: { kind: 'FactPattern', factType: 'Transaction', binding: '$tx', constraints: [] },
      functions: [{ binding: '$total', function: Aggregate.Sum, argument: '$tx.amount' }],
      resultConstraint: '$total > 1000',
    }])
    expect(drl).toContain('accumulate(')
    expect(drl).toContain(`$total : ${Aggregate.Sum}( $tx.amount )`)
    expect(drl).toContain('$total > 1000')
  })

  it('generates accumulate with multiple functions', () => {
    const drl = generate([{
      kind: 'Accumulate',
      source: { kind: 'FactPattern', factType: 'Transaction', binding: '$tx', constraints: [] },
      functions: [
        { binding: '$total', function: Aggregate.Sum, argument: '$tx.amount' },
        { binding: '$count', function: Aggregate.Count, argument: '$tx' },
      ],
    }])
    expect(drl).toContain(`$total : ${Aggregate.Sum}( $tx.amount )`)
    expect(drl).toContain(`$count : ${Aggregate.Count}( $tx )`)
  })
})

describe('MetaToDRLTransformer — FromCondition', () => {
  it('generates a from condition', () => {
    const drl = generate([{
      kind: 'From',
      pattern: { kind: 'FactPattern', factType: 'Transaction', binding: '$tx', constraints: [] },
      expression: '$txList',
    }])
    expect(drl).toContain('from $txList')
    expect(drl).toContain('$tx : Transaction(  )')
  })
})

describe('MetaToDRLTransformer — EvalCondition', () => {
  it('generates eval()', () => {
    const drl = generate([{ kind: 'Eval', expression: 'x > 0' }])
    expect(drl).toContain('eval( x > 0 )')
  })
})

describe('MetaToDRLTransformer — RawCondition', () => {
  it('emits the drl string verbatim', () => {
    const drl = generate([{ kind: 'RawCondition', drl: 'custom drl fragment' }])
    expect(drl).toContain('custom drl fragment')
  })
})

// ─── Consequence generation ───────────────────────────────────────────────────

describe('MetaToDRLTransformer — ModifyConsequence', () => {
  it('generates modify with a single modification', () => {
    const drl = generate([], [{
      kind: 'ModifyConsequence',
      binding: '$p',
      modifications: [{ method: 'setScore', args: ['200'] }],
    }])
    expect(drl).toContain('modify( $p )')
    expect(drl).toContain('setScore( 200 )')
  })

  it('generates modify with multiple modifications', () => {
    const drl = generate([], [{
      kind: 'ModifyConsequence',
      binding: '$p',
      modifications: [
        { method: 'setScore', args: ['200'] },
        { method: 'setLevel', args: ['3'] },
      ],
    }])
    expect(drl).toContain('setScore( 200 )')
    expect(drl).toContain('setLevel( 3 )')
  })
})

describe('MetaToDRLTransformer — InsertConsequence', () => {
  it('generates insert()', () => {
    const drl = generate([], [{ kind: 'InsertConsequence', objectExpression: 'new Alert()' }])
    expect(drl).toContain('insert( new Alert() );')
  })
})

describe('MetaToDRLTransformer — RetractConsequence', () => {
  it('generates retract()', () => {
    const drl = generate([], [{ kind: 'RetractConsequence', binding: '$p' }])
    expect(drl).toContain('retract( $p );')
  })
})

describe('MetaToDRLTransformer — SetGlobalConsequence', () => {
  it('generates the expression with semicolon', () => {
    const drl = generate([], [{ kind: 'SetGlobalConsequence', expression: 'service.log()' }])
    expect(drl).toContain('service.log();')
  })
})

describe('MetaToDRLTransformer — RawConsequence', () => {
  it('emits the code verbatim with semicolon', () => {
    const drl = generate([], [{ kind: 'RawConsequence', code: 'System.out.println("x")' }])
    expect(drl).toContain('System.out.println("x");')
  })
})

// ─── Rule generation ──────────────────────────────────────────────────────────

describe('MetaToDRLTransformer — rule attributes', () => {
  it('generates rule name', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'My Rule', conditions: [], consequences: [] })
    expect(drl).toContain('rule "My Rule"')
    expect(drl).toContain('end')
  })

  it('generates salience', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'R', salience: 100, conditions: [], consequences: [] })
    expect(drl).toContain('salience 100')
  })

  it('generates agenda-group', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'R', agendaGroup: 'fraud', conditions: [], consequences: [] })
    expect(drl).toContain('agenda-group "fraud"')
  })

  it('generates no-loop true', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'R', noLoop: true, conditions: [], consequences: [] })
    expect(drl).toContain('no-loop true')
  })

  it('does not emit no-loop when false', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'R', noLoop: false, conditions: [], consequences: [] })
    expect(drl).not.toContain('no-loop')
  })

  it('generates lock-on-active true', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'R', lockOnActive: true, conditions: [], consequences: [] })
    expect(drl).toContain('lock-on-active true')
  })

  it('generates ruleflow-group', () => {
    const drl = MetaToDRLTransformer.generateRule({ name: 'R', ruleFlowGroup: 'flow1', conditions: [], consequences: [] })
    expect(drl).toContain('ruleflow-group "flow1"')
  })
})

describe('MetaToDRLTransformer — DroolsFile', () => {
  it('generates imports', () => {
    const file: DroolsFile = {
      name: 'test',
      imports: ['com.example.Player', 'com.example.Game'],
      rules: [{ name: 'R', conditions: [], consequences: [] }],
    }
    const drl = MetaToDRLTransformer.generate(file)
    expect(drl).toContain('import com.example.Player;')
    expect(drl).toContain('import com.example.Game;')
  })

  it('generates multiple rules', () => {
    const file: DroolsFile = {
      name: 'test',
      imports: [],
      rules: [
        { name: 'Rule One', conditions: [], consequences: [] },
        { name: 'Rule Two', conditions: [], consequences: [] },
      ],
    }
    const drl = MetaToDRLTransformer.generate(file)
    expect(drl).toContain('rule "Rule One"')
    expect(drl).toContain('rule "Rule Two"')
  })

  it('omits import section when there are no imports', () => {
    const file: DroolsFile = {
      name: 'test',
      imports: [],
      rules: [{ name: 'R', conditions: [], consequences: [] }],
    }
    const drl = MetaToDRLTransformer.generate(file)
    expect(drl).not.toContain('import')
  })
})
