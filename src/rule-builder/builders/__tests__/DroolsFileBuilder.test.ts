import { describe, it, expect } from 'vitest'
import { DroolsFileBuilder, createFile } from '../DroolsFileBuilder'
import { createRule } from '../RuleBuilder'
import { fact } from '../index'
import { Operator } from '../enums'

describe('DroolsFileBuilder', () => {
  it('createFile() initialises with the given name and empty collections', () => {
    const file = createFile('my-rules').build()
    expect(file.name).toBe('my-rules')
    expect(file.imports).toEqual([])
    expect(file.globals).toEqual([])
    expect(file.rules).toEqual([])
  })

  it('returns a DroolsFileBuilder instance', () => {
    expect(createFile('test')).toBeInstanceOf(DroolsFileBuilder)
  })

  describe('.import()', () => {
    it('adds a single import', () => {
      const file = createFile('f').import('com.example.Player').build()
      expect(file.imports).toEqual(['com.example.Player'])
    })

    it('adds multiple imports in order', () => {
      const file = createFile('f')
        .import('com.example.Player')
        .import('com.example.Game')
        .import('com.example.Transaction')
        .build()
      expect(file.imports).toEqual([
        'com.example.Player',
        'com.example.Game',
        'com.example.Transaction',
      ])
    })

    it('is chainable', () => {
      const builder = createFile('f').import('com.example.A')
      expect(builder).toBeInstanceOf(DroolsFileBuilder)
    })
  })

  describe('.global()', () => {
    it('adds a single global declaration', () => {
      const file = createFile('f').global('com.example.AlertService', 'alertService').build()
      expect(file.globals).toEqual([{ type: 'com.example.AlertService', name: 'alertService' }])
    })

    it('adds multiple globals in order', () => {
      const file = createFile('f')
        .global('com.example.AlertService', 'alertService')
        .global('java.util.List', 'results')
        .build()
      expect(file.globals).toEqual([
        { type: 'com.example.AlertService', name: 'alertService' },
        { type: 'java.util.List', name: 'results' },
      ])
    })

    it('is chainable', () => {
      const builder = createFile('f').global('com.example.Foo', 'foo')
      expect(builder).toBeInstanceOf(DroolsFileBuilder)
    })
  })

  describe('.addRule()', () => {
    it('accepts a plain Rule object', () => {
      const rule = { name: 'My Rule', conditions: [], consequences: [] }
      const file = createFile('f').addRule(rule).build()
      expect(file.rules).toHaveLength(1)
      expect(file.rules[0].name).toBe('My Rule')
    })

    it('accepts a RuleBuilder and auto-resolves it', () => {
      const rule = createRule('Built Rule')
        .salience(10)
        .addCondition(fact('Player', '$p').field('score', Operator.Gte, '100'))
      const file = createFile('f').addRule(rule).build()
      expect(file.rules).toHaveLength(1)
      expect(file.rules[0].name).toBe('Built Rule')
      expect(file.rules[0].salience).toBe(10)
    })

    it('adds multiple rules in order', () => {
      const file = createFile('f')
        .addRule(createRule('Rule A'))
        .addRule(createRule('Rule B'))
        .addRule(createRule('Rule C'))
        .build()
      expect(file.rules).toHaveLength(3)
      expect(file.rules.map(r => r.name)).toEqual(['Rule A', 'Rule B', 'Rule C'])
    })

    it('mixes plain Rule objects and RuleBuilders', () => {
      const file = createFile('f')
        .addRule({ name: 'Plain', conditions: [], consequences: [] })
        .addRule(createRule('Built'))
        .build()
      expect(file.rules).toHaveLength(2)
      expect(file.rules[0].name).toBe('Plain')
      expect(file.rules[1].name).toBe('Built')
    })
  })

  describe('.build()', () => {
    it('returns a copy — mutating the builder does not affect the built file', () => {
      const builder = createFile('f').import('com.example.A')
      const file1 = builder.build()
      builder.import('com.example.B')
      const file2 = builder.build()
      expect(file1.imports).toHaveLength(1)
      expect(file2.imports).toHaveLength(2)
    })

    it('produces a complete DroolsFile', () => {
      const file = createFile('fraud-rules')
        .import('com.example.Account')
        .import('com.example.FraudAlert')
        .addRule(createRule('Detect Fraud').salience(100).noLoop())
        .addRule(createRule('Clear Alert').salience(10))
        .build()

      expect(file).toEqual({
        name: 'fraud-rules',
        imports: ['com.example.Account', 'com.example.FraudAlert'],
        globals: [],
        rules: [
          expect.objectContaining({ name: 'Detect Fraud', salience: 100, noLoop: true }),
          expect.objectContaining({ name: 'Clear Alert', salience: 10 }),
        ],
      })
    })
  })
})
