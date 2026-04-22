# drools-builder

A TypeScript library for building, parsing, and generating Drools rules programmatically.

## Install

```bash
npm install drools-builder
```

---

## Building rules

Two styles are supported and can be freely mixed.

### Factory functions

Best for composing and reusing conditions independently.

```typescript
import { createFile, createRule, fact, not, unbound, modify, insert, Operator, Aggregate } from 'drools-builder'

const rule = createRule('Fraud Detection')
  .salience(100)
  .agendaGroup('fraud-evaluation')
  .noLoop()
  .addCondition(
    fact('Account', '$account')
      .field('status', Operator.Eq, 'Account.Status.ACTIVE')
      .bind('$accountId', 'id'),
  )
  .addCondition(
    not(unbound('FraudAlert').field('accountId', Operator.Eq, '$accountId')),
  )
  .addCondition(
    accumulate(fact('Transaction', '$tx').field('amount', Operator.Gt, '1500.00'))
      .fn('$recentTxs', Aggregate.CollectList, '$tx')
      .resultConstraint('size >= 3'),
  )
  .addConsequence(modify('$account').call('setStatus', 'Account.Status.FROZEN'))
  .addConsequence(insert('new FraudAlert()'))
  .build()
```

### Callback blocks

Mirrors the DRL `when`/`then` structure.

```typescript
const rule = createRule('Fraud Detection')
  .salience(100)
  .noLoop()
  .when(lhs => {
    lhs.fact('Account', '$account', p => p
      .field('status', Operator.Eq, 'Account.Status.ACTIVE')
      .bind('$accountId', 'id'),
    )
    lhs.not(b => b.fact('FraudAlert', p => p
      .field('accountId', Operator.Eq, '$accountId'),
    ))
  })
  .then(rhs => {
    rhs.modify('$account', m => m.call('setStatus', 'Account.Status.FROZEN'))
    rhs.insert('new FraudAlert()')
  })
  .build()
```

Plain metamodel objects are accepted everywhere a builder is expected.

---

## Building a file

```typescript
const file = createFile('fraud-rules')
  .import('com.example.Account')
  .import('com.example.FraudAlert')
  .global('com.example.AlertService', 'alertService')
  .addRule(rule)
  .addRule(createRule('Another Rule').when(...).then(...))
  .build()
```

---

## Generating DRL

```typescript
import { MetaToDRLTransformer } from 'drools-builder'

const drl = MetaToDRLTransformer.generate(file)    // full file
const drl = MetaToDRLTransformer.generateRule(rule) // single rule
```

---

## Parsing DRL

```typescript
import { DRLToMetaTransformer } from 'drools-builder'

const file = DRLToMetaTransformer.parse(drlString)      // full file → DroolsFile
const rule = DRLToMetaTransformer.parseRule(ruleBlock)  // single rule → Rule
```

---

## Enums

Use `Operator` and `Aggregate` instead of raw strings to avoid typos.

```typescript
import { Operator, Aggregate } from 'drools-builder'

Operator.Eq           // '=='
Operator.Gte          // '>='
Operator.NotContains  // 'not contains'

Aggregate.Sum         // 'sum'
Aggregate.CollectList // 'collectList'
```

---

## License

MIT
