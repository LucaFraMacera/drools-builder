import { describe, it, expect } from 'vitest'
import { DRLToMetaTransformer } from '../DRLToMetaTransformer'
import { Operator, Aggregate } from '../../builders/enums'
import type { FactPattern, OrCondition, AccumulatePattern, FromCondition } from '../../metamodel/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRule(drl: string) {
  return DRLToMetaTransformer.parse(`rule "Test"\nwhen\n${drl}\nthen\nend`).rules[0]
}

function parseThen(drl: string) {
  return DRLToMetaTransformer.parse(`rule "Test"\nwhen\nthen\n${drl}\nend`).rules[0]
}

// ─── File-level parsing ───────────────────────────────────────────────────────

describe('DRLToMetaTransformer.parse() — file level', () => {
  it('parses imports', () => {
    const file = DRLToMetaTransformer.parse(`
      import com.example.model.Player;
      import com.example.model.Game;
      rule "R" when then end
    `)
    expect(file.imports).toEqual(['com.example.model.Player', 'com.example.model.Game'])
  })

  it('returns an empty imports array when there are none', () => {
    const file = DRLToMetaTransformer.parse('rule "R" when then end')
    expect(file.imports).toEqual([])
  })

  it('parses multiple rules', () => {
    const file = DRLToMetaTransformer.parse(`
      rule "Rule One" when then end
      rule "Rule Two" when then end
    `)
    expect(file.rules).toHaveLength(2)
    expect(file.rules[0].name).toBe('Rule One')
    expect(file.rules[1].name).toBe('Rule Two')
  })

  it('strips single-line comments', () => {
    const file = DRLToMetaTransformer.parse(`
      // This is a comment
      rule "R" when then end
    `)
    expect(file.rules).toHaveLength(1)
  })

  it('strips block comments', () => {
    const file = DRLToMetaTransformer.parse(`
      /* block comment */
      rule "R" when then end
    `)
    expect(file.rules).toHaveLength(1)
  })
})

// ─── Rule attributes ──────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — rule attributes', () => {
  it('parses rule name', () => {
    const rule = DRLToMetaTransformer.parse('rule "My Rule" when then end').rules[0]
    expect(rule.name).toBe('My Rule')
  })

  it('parses salience', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" salience 100 when then end').rules[0]
    expect(rule.salience).toBe(100)
  })

  it('parses negative salience', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" salience -5 when then end').rules[0]
    expect(rule.salience).toBe(-5)
  })

  it('parses no-loop true', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" no-loop true when then end').rules[0]
    expect(rule.noLoop).toBe(true)
  })

  it('parses bare no-loop as true', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" no-loop when then end').rules[0]
    expect(rule.noLoop).toBe(true)
  })

  it('does not set noLoop for no-loop false', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" no-loop false when then end').rules[0]
    expect(rule.noLoop).toBeUndefined()
  })

  it('parses lock-on-active true', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" lock-on-active true when then end').rules[0]
    expect(rule.lockOnActive).toBe(true)
  })

  it('parses bare lock-on-active as true', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" lock-on-active when then end').rules[0]
    expect(rule.lockOnActive).toBe(true)
  })

  it('does not set lockOnActive for lock-on-active false', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" lock-on-active false when then end').rules[0]
    expect(rule.lockOnActive).toBeUndefined()
  })

  it('parses agenda-group', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" agenda-group "fraud" when then end').rules[0]
    expect(rule.agendaGroup).toBe('fraud')
  })

  it('parses ruleflow-group', () => {
    const rule = DRLToMetaTransformer.parse('rule "R" ruleflow-group "flow1" when then end').rules[0]
    expect(rule.ruleFlowGroup).toBe('flow1')
  })
})

// ─── Condition parsing ────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — FactPattern', () => {
  it('parses a FactPattern with binding', () => {
    const rule = parseRule(`$p : Player( score ${Operator.Gte} 100 )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.kind).toBe('FactPattern')
    expect(c.factType).toBe('Player')
    expect(c.binding).toBe('$p')
    expect(c.constraints).toHaveLength(1)
    expect(c.constraints[0]).toMatchObject({
      kind: 'FieldConstraint',
      field: 'score',
      operator: Operator.Gte,
      value: '100',
    })
  })

  it('parses a FactPattern without binding', () => {
    const rule = parseRule(`Player( score ${Operator.Gte} 100 )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.binding).toBeUndefined()
    expect(c.factType).toBe('Player')
  })

  it('parses a FactPattern with no constraints', () => {
    const rule = parseRule('Player()')
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints).toEqual([])
  })

  it('parses a BindingConstraint', () => {
    const rule = parseRule('$p : Player( $id : id )')
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toEqual({ kind: 'BindingConstraint', binding: '$id', field: 'id' })
  })

  it('parses all standard equality and comparison operators', () => {
    const operators = [Operator.Eq, Operator.Neq, Operator.Gt, Operator.Lt, Operator.Gte, Operator.Lte]
    for (const op of operators) {
      const rule = parseRule(`$p : Player( score ${op} 100 )`)
      const c = rule.conditions[0] as FactPattern
      expect(c.constraints[0]).toMatchObject({ kind: 'FieldConstraint', operator: op })
    }
  })

  it('parses multi-word operator: NotContains', () => {
    const rule = parseRule(`$p : Player( tags ${Operator.NotContains} "vip" )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.NotContains })
  })

  it('parses multi-word operator: NotMemberOf', () => {
    const rule = parseRule(`$p : Player( role ${Operator.NotMemberOf} $roles )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.NotMemberOf })
  })

  it('parses multi-word operator: Contains', () => {
    const rule = parseRule(`$p : Player( tags ${Operator.Contains} "admin" )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.Contains })
  })

  it('parses multi-word operator: MemberOf', () => {
    const rule = parseRule(`$p : Player( role ${Operator.MemberOf} $roles )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints[0]).toMatchObject({ operator: Operator.MemberOf })
  })

  it('parses multiple constraints on one pattern', () => {
    const rule = parseRule(`$p : Player( score ${Operator.Gte} 100, active ${Operator.Eq} true )`)
    const c = rule.conditions[0] as FactPattern
    expect(c.constraints).toHaveLength(2)
  })
})

describe('DRLToMetaTransformer — not() condition', () => {
  it('parses not() wrapping an UnboundPattern', () => {
    const rule = parseRule(`not( FraudAlert( status ${Operator.Eq} "UNRESOLVED" ) )`)
    expect(rule.conditions[0]).toMatchObject({
      kind: 'Not',
      condition: { kind: 'UnboundPattern', factType: 'FraudAlert' },
    })
  })
})

describe('DRLToMetaTransformer — exists() condition', () => {
  it('parses exists() wrapping an UnboundPattern', () => {
    const rule = parseRule(`exists( Player( score ${Operator.Gt} 0 ) )`)
    expect(rule.conditions[0]).toMatchObject({
      kind: 'Exists',
      condition: { kind: 'UnboundPattern', factType: 'Player' },
    })
  })
})

describe('DRLToMetaTransformer — or() condition', () => {
  it('parses an explicit or keyword', () => {
    const rule = parseRule(`$p : Player( score ${Operator.Gt} 0 ) or $p : Player( vip ${Operator.Eq} true )`)
    const c = rule.conditions[0] as OrCondition
    expect(c.kind).toBe('Or')
    expect(c.conditions).toHaveLength(2)
  })
})

describe('DRLToMetaTransformer — eval() condition', () => {
  it('parses an eval condition', () => {
    const rule = parseRule('eval( $p.getScore() > 100 )')
    expect(rule.conditions[0]).toEqual({ kind: 'Eval', expression: '$p.getScore() > 100' })
  })
})

describe('DRLToMetaTransformer — accumulate condition', () => {
  it('parses an accumulate with a single function', () => {
    const rule = parseRule(`
      accumulate(
        $tx : Transaction( amount ${Operator.Gt} 0 );
        $total : ${Aggregate.Sum}( $tx.amount )
      )
    `)
    const c = rule.conditions[0] as AccumulatePattern
    expect(c.kind).toBe('Accumulate')
    expect(c.source).toMatchObject({ kind: 'FactPattern', factType: 'Transaction' })
    expect(c.functions).toHaveLength(1)
    expect(c.functions[0]).toEqual({
      binding: '$total',
      function: Aggregate.Sum,
      argument: '$tx.amount',
    })
  })

  it('parses an accumulate with multiple functions', () => {
    const rule = parseRule(`
      accumulate(
        $tx : Transaction( amount ${Operator.Gt} 0 );
        $total : ${Aggregate.Sum}( $tx.amount ), $count : ${Aggregate.Count}( $tx )
      )
    `)
    const c = rule.conditions[0] as AccumulatePattern
    expect(c.functions).toHaveLength(2)
    expect(c.functions[0].function).toBe(Aggregate.Sum)
    expect(c.functions[1].function).toBe(Aggregate.Count)
  })
})

describe('DRLToMetaTransformer — from condition', () => {
  it('parses a from condition', () => {
    const rule = parseRule(`$tx : Transaction( amount ${Operator.Gt} 0 ) from $txList`)
    const c = rule.conditions[0] as FromCondition
    expect(c.kind).toBe('From')
    expect(c.pattern).toMatchObject({ kind: 'FactPattern', factType: 'Transaction' })
    expect(c.expression).toBe('$txList')
  })
})

// ─── Consequence parsing ──────────────────────────────────────────────────────

describe('DRLToMetaTransformer — consequences', () => {
  it('parses a modify consequence', () => {
    const rule = parseThen('modify( $p ) { setScore( 200 ) };')
    expect(rule.consequences[0]).toMatchObject({
      kind: 'ModifyConsequence',
      binding: '$p',
      modifications: [{ method: 'setScore', args: ['200'] }],
    })
  })

  it('parses a modify with multiple modifications', () => {
    const rule = parseThen('modify( $p ) { setScore( 200 ), setLevel( 3 ) };')
    const c = rule.consequences[0] as any
    expect(c.modifications).toHaveLength(2)
  })

  it('parses an insert consequence', () => {
    const rule = parseThen('insert( new Alert() );')
    expect(rule.consequences[0]).toEqual({ kind: 'InsertConsequence', objectExpression: 'new Alert()' })
  })

  it('parses a retract consequence', () => {
    const rule = parseThen('retract( $p );')
    expect(rule.consequences[0]).toEqual({ kind: 'RetractConsequence', binding: '$p' })
  })

  it('parses an unknown statement as RawConsequence', () => {
    const rule = parseThen('System.out.println("hello");')
    expect(rule.consequences[0]).toMatchObject({ kind: 'RawConsequence', code: 'System.out.println("hello")' })
  })

  it('parses multiple consequences in sequence', () => {
    const rule = parseThen('insert( new Alert() );\nretract( $p );')
    expect(rule.consequences).toHaveLength(2)
  })

  it('parses an if block as IfConsequence', () => {
    const rule = parseThen('if (x > 0) {\n  insert( new Alert() );\n}')
    expect(rule.consequences[0]).toMatchObject({
      kind: 'IfConsequence',
      condition: 'x > 0',
      then: [{ kind: 'InsertConsequence', objectExpression: 'new Alert()' }],
    })
    expect((rule.consequences[0] as any).else).toBeUndefined()
  })

  it('parses an if/else block as IfConsequence', () => {
    const rule = parseThen('if (score > 50) {\n  insert( new Reward() );\n} else {\n  retract( $p );\n}')
    const c = rule.consequences[0] as any
    expect(c.kind).toBe('IfConsequence')
    expect(c.condition).toBe('score > 50')
    expect(c.then[0]).toMatchObject({ kind: 'InsertConsequence' })
    expect(c.else[0]).toMatchObject({ kind: 'RetractConsequence' })
  })

  it('parses consequences after an if block', () => {
    const rule = parseThen('if (x > 0) {\n  insert( new Alert() );\n}\nretract( $p );')
    expect(rule.consequences).toHaveLength(2)
    expect(rule.consequences[0]).toMatchObject({ kind: 'IfConsequence' })
    expect(rule.consequences[1]).toMatchObject({ kind: 'RetractConsequence' })
  })
})

// ─── Nested if consequence ────────────────────────────────────────────────────

describe('DRLToMetaTransformer — nested IfConsequence', () => {
  it('parses a nested if inside an outer if', () => {
    const rule = parseThen(`
      if($bs !=null){
        if((boolean) $bs == true) {
          update($bsTrips);
          update($bsKm);
        }
      }
    `)
    const outer = rule.consequences[0] as any
    expect(outer.kind).toBe('IfConsequence')
    expect(outer.condition).toBe('$bs !=null')
    expect(outer.then).toHaveLength(1)
    const inner = outer.then[0] as any
    expect(inner.kind).toBe('IfConsequence')
    expect(inner.condition).toBe('(boolean) $bs == true')
    expect(inner.then).toHaveLength(2)
  })

  it('parses the exact bike rule then block', () => {
    const rule = parseThen(`
        if($bs !=null){
        if((boolean) $bs == true) {
            utils.log("apply 'BikeSharing_Trips and BikeSharing_Km update'");
            $bsTrips.setScore($bsTrips.getScore() + 1.0d);
            $bsKm.setScore($bsKm.getScore() + (Double) $km);
            update($bsTrips);
            update($bsKm);
        }
    }
    utils.log("apply 'Bike_Trips and Bike_Km update'")
        $bikeTrips.setScore($bikeTrips.getScore() + 1.0d)
        $bikeKm.setScore($bikeKm.getScore() + (Double) $km)
        update($bikeTrips)
        update($bikeKm)
    `)
    console.log('consequences:', JSON.stringify(rule.consequences, null, 2))
    expect(rule.consequences[0]).toMatchObject({ kind: 'IfConsequence' })
  })
})

// ─── Return consequence ───────────────────────────────────────────────────────

describe('DRLToMetaTransformer — ReturnConsequence', () => {
  it('parses return with expression', () => {
    const rule = parseThen('return $p.getScore();')
    expect(rule.consequences[0]).toEqual({ kind: 'ReturnConsequence', expression: '$p.getScore()' })
  })

  it('parses bare return', () => {
    const rule = parseThen('return;')
    expect(rule.consequences[0]).toEqual({ kind: 'ReturnConsequence', expression: '' })
  })
})

// ─── Function definitions ─────────────────────────────────────────────────────

describe('DRLToMetaTransformer — function definitions', () => {
  it('parses a void function with no params', () => {
    const file = DRLToMetaTransformer.parse(`
      function void greet() {
        System.out.println("hello");
      }
      rule "R" when then end
    `)
    expect(file.functions).toHaveLength(1)
    expect(file.functions![0]).toMatchObject({ returnType: 'void', name: 'greet', params: '' })
    expect(file.functions![0].body[0]).toMatchObject({ kind: 'RawConsequence', code: 'System.out.println("hello")' })
  })

  it('parses a function with params and return', () => {
    const file = DRLToMetaTransformer.parse(`
      function double add(double a, double b) {
        return a + b;
      }
      rule "R" when then end
    `)
    expect(file.functions![0]).toMatchObject({ returnType: 'double', name: 'add', params: 'double a, double b' })
    expect(file.functions![0].body[0]).toMatchObject({ kind: 'ReturnConsequence', expression: 'a + b' })
  })

  it('parses multiple functions', () => {
    const file = DRLToMetaTransformer.parse(`
      function void a() { return; }
      function void b() { return; }
      rule "R" when then end
    `)
    expect(file.functions).toHaveLength(2)
    expect(file.functions![0].name).toBe('a')
    expect(file.functions![1].name).toBe('b')
  })
})

// ─── Class declarations ───────────────────────────────────────────────────────

describe('DRLToMetaTransformer — class declarations', () => {
  it('parses a declare block with attributes', () => {
    const file = DRLToMetaTransformer.parse(`
      declare Person
        name : String
        age  : int
      end
      rule "R" when then end
    `)
    expect(file.declarations).toHaveLength(1)
    expect(file.declarations![0].className).toBe('Person')
    expect(file.declarations![0].attributes).toHaveLength(2)
    expect(file.declarations![0].attributes[0]).toEqual({ name: 'name', type: 'String' })
    expect(file.declarations![0].attributes[1]).toEqual({ name: 'age', type: 'int' })
  })

  it('parses a declare block with no attributes', () => {
    const file = DRLToMetaTransformer.parse(`
      declare Marker
      end
      rule "R" when then end
    `)
    expect(file.declarations![0]).toMatchObject({ className: 'Marker', attributes: [] })
  })

  it('parses multiple declare blocks', () => {
    const file = DRLToMetaTransformer.parse(`
      declare A
        x : double
      end
      declare B
        y : String
      end
      rule "R" when then end
    `)
    expect(file.declarations).toHaveLength(2)
    expect(file.declarations![0].className).toBe('A')
    expect(file.declarations![1].className).toBe('B')
  })
})

// ─── WhileConsequence ─────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — WhileConsequence', () => {
  it('parses a while loop', () => {
    const rule = parseThen('while ($i < 10) {\n  update($x);\n}')
    expect(rule.consequences[0]).toMatchObject({ kind: 'WhileConsequence', condition: '$i < 10' })
    expect((rule.consequences[0] as any).body[0]).toMatchObject({ kind: 'RawConsequence', code: 'update($x)' })
  })

  it('parses consequences after a while loop', () => {
    const rule = parseThen('while (true) {\n  retract($p);\n}\ninsert( new Object() );')
    expect(rule.consequences[0]).toMatchObject({ kind: 'WhileConsequence' })
    expect(rule.consequences[1]).toMatchObject({ kind: 'InsertConsequence' })
  })
})

// ─── ForEachConsequence ───────────────────────────────────────────────────────

describe('DRLToMetaTransformer — ForEachConsequence', () => {
  it('parses a for-each loop', () => {
    const rule = parseThen('for (String item : $list) {\n  update($x);\n}')
    expect(rule.consequences[0]).toMatchObject({
      kind: 'ForEachConsequence', typeName: 'String', varName: 'item', collection: '$list',
    })
    expect((rule.consequences[0] as any).body).toHaveLength(1)
  })

  it('parses a for-each with a generic type', () => {
    const rule = parseThen('for (Map.Entry<String, Integer> e : $map.entrySet()) {\n  update($x);\n}')
    expect((rule.consequences[0] as any).kind).toBe('ForEachConsequence')
  })
})

// ─── ForConsequence ───────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — ForConsequence', () => {
  it('parses a classic for loop', () => {
    const rule = parseThen('for (int i = 0; i < 10; i++) {\n  update($x);\n}')
    expect(rule.consequences[0]).toMatchObject({
      kind: 'ForConsequence', init: 'int i = 0', condition: 'i < 10', update: 'i++',
    })
    expect((rule.consequences[0] as any).body).toHaveLength(1)
  })
})

// ─── SwitchConsequence ────────────────────────────────────────────────────────

describe('DRLToMetaTransformer — SwitchConsequence', () => {
  it('parses a switch with cases', () => {
    const rule = parseThen(`
      switch ($status) {
        case "active":
          update($x);
          break;
        case "inactive":
          retract($p);
          break;
      }
    `)
    const sw = rule.consequences[0] as any
    expect(sw.kind).toBe('SwitchConsequence')
    expect(sw.expression).toBe('$status')
    expect(sw.cases).toHaveLength(2)
    expect(sw.cases[0]).toMatchObject({ kind: 'CaseConsequence', value: '"active"' })
    expect(sw.cases[1]).toMatchObject({ kind: 'CaseConsequence', value: '"inactive"' })
    expect(sw.default).toBeUndefined()
  })

  it('parses a switch with a default', () => {
    const rule = parseThen(`
      switch ($n) {
        case 1:
          insert( new Object() );
          break;
        default:
          retract($p);
      }
    `)
    const sw = rule.consequences[0] as any
    expect(sw.cases).toHaveLength(1)
    expect(sw.default).toHaveLength(1)
    expect(sw.default[0]).toMatchObject({ kind: 'RetractConsequence' })
  })
})
