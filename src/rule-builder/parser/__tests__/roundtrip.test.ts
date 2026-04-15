import { describe, it, expect } from 'vitest'
import { DRLToMetaTransformer } from '../DRLToMetaTransformer'
import { MetaToDRLTransformer } from '../MetaToDRLTransformer'
import type { Rule } from '../../metamodel/types'

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parse a DRL string, regenerate it, parse again, and return both parsed rules.
 * Round-trip is stable when conditions and consequences are structurally identical.
 */
function roundtrip(drl: string): { pass1: Rule; pass2: Rule } {
  const meta1 = DRLToMetaTransformer.parse(drl)
  const regenerated = MetaToDRLTransformer.generate(meta1)
  const meta2 = DRLToMetaTransformer.parse(regenerated)
  return { pass1: meta1.rules[0], pass2: meta2.rules[0] }
}

function assertStable(drl: string) {
  const { pass1, pass2 } = roundtrip(drl)
  expect(JSON.stringify(pass2.conditions)).toBe(JSON.stringify(pass1.conditions))
  expect(JSON.stringify(pass2.consequences)).toBe(JSON.stringify(pass1.consequences))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Round-trip stability', () => {
  it('simple fact pattern rule', () => {
    assertStable(`
      import com.example.Player;
      rule "Simple Rule"
        salience 10
      when
        $p : Player( score >= 100 )
      then
        insert( new Object() );
      end
    `)
  })

  it('rule with rule attributes', () => {
    assertStable(`
      rule "Attributed Rule"
        salience 50
        agenda-group "group1"
        no-loop true
        lock-on-active true
      when
        $p : Player( active == true )
      then
        retract( $p );
      end
    `)
  })

  it('rule with not() and exists() conditions', () => {
    assertStable(`
      rule "Not Exists Rule"
      when
        $p : Player( score > 0 )
        not( FraudAlert( accountId == $p.id ) )
        exists( Game( active == true ) )
      then
        insert( new Object() );
      end
    `)
  })

  it('rule with accumulate condition', () => {
    assertStable(`
      rule "Accumulate Rule"
      when
        accumulate(
          $tx : Transaction( amount > 0 );
          $total : sum( $tx.amount ), $count : count( $tx )
        )
      then
        insert( new Object() );
      end
    `)
  })

  it('rule with from condition', () => {
    assertStable(`
      rule "From Rule"
      when
        $p : Player( score > 0 )
        $tx : Transaction( amount > 0 ) from $p.transactions
      then
        retract( $tx );
      end
    `)
  })

  it('rule with eval condition', () => {
    assertStable(`
      rule "Eval Rule"
      when
        $p : Player( score > 0 )
        eval( $p.getScore() > 100 )
      then
        insert( new Object() );
      end
    `)
  })

  it('rule with modify consequence', () => {
    assertStable(`
      rule "Modify Rule"
      when
        $p : Player( score < 100 )
      then
        modify( $p ) {
          setScore( 200 ),
          setLevel( 3 )
        };
      end
    `)
  })

  it('complex fraud detection rule', () => {
    assertStable(`
      import com.example.model.Transaction;
      import com.example.model.Account;
      import com.example.model.FraudAlert;

      rule "High-Velocity Multi-IP High-Value Fraud Detection"
        salience 100
        agenda-group "fraud-evaluation"
        no-loop true

      when
        $account : Account( status == Account.Status.ACTIVE, $accountId : id )

        not( FraudAlert( accountId == $accountId, status == "UNRESOLVED" ) )

        accumulate(
          $tx : Transaction( accountId == $accountId, amount > 1500.00, status == "COMPLETED" );
          $recentHighValueTxs : collectList( $tx )
        )

        accumulate(
          Transaction( $amt : amount ) from $recentHighValueTxs;
          $txSum : sum( $amt )
        )

      then
        modify( $account ) {
          setStatus( Account.Status.FROZEN ),
          setRemarks( "Frozen by automated fraud detection" )
        };

        insert( new FraudAlert() );

      end
    `)
  })

  it('multi-rule file', () => {
    const drl = `
      import com.example.Player;

      rule "Rule One"
        salience 10
      when
        $p : Player( score >= 100 )
      then
        insert( new Object() );
      end

      rule "Rule Two"
        salience 5
        no-loop true
      when
        $p : Player( active == false )
      then
        retract( $p );
      end
    `
    const meta1 = DRLToMetaTransformer.parse(drl)
    const regen = MetaToDRLTransformer.generate(meta1)
    const meta2 = DRLToMetaTransformer.parse(regen)

    expect(meta2.rules).toHaveLength(2)
    for (let i = 0; i < 2; i++) {
      expect(JSON.stringify(meta2.rules[i].conditions)).toBe(JSON.stringify(meta1.rules[i].conditions))
      expect(JSON.stringify(meta2.rules[i].consequences)).toBe(JSON.stringify(meta1.rules[i].consequences))
    }
  })
})
