// ─── CONSTRAINT ──────────────────────────────────────────────────────────────

export type ConstraintOperator =
  | '==' | '!=' | '>' | '<' | '>=' | '<='
  | 'contains' | 'not contains'
  | 'memberOf' | 'not memberOf'
  | 'matches' | 'not matches'

export interface FieldConstraint {
  kind: 'FieldConstraint'
  field: string
  operator: ConstraintOperator
  value: string        // raw string — covers literals, enums, bindings, expressions
  binding?: string     // optional result binding: $v : field op value
}

export interface BindingConstraint {
  kind: 'BindingConstraint'
  binding: string
  field: string
}

export interface RawConstraint {
  kind: 'RawConstraint'
  expression: string   // verbatim — emitted as-is by MetaToDRLTransformer
}

export type Constraint = FieldConstraint | BindingConstraint | RawConstraint

// ─── CONDITION (LHS) — Recursive Boolean Expression Tree ─────────────────────

export type FactType = string  // open — covers built-in and custom types

export interface FactPattern {
  kind: 'FactPattern'
  factType: FactType
  binding?: string
  constraints: Constraint[]
}

// A pattern that cannot carry a variable binding.
// Used inside not() and forall() where Drools forbids bindings by definition —
// the fact is asserted absent, so there is nothing for a variable to point to.
export interface UnboundPattern {
  kind: 'UnboundPattern'
  factType: FactType
  constraints: Constraint[]
}

export interface AndCondition {
  kind: 'And'
  conditions: Condition[]
}

export interface OrCondition {
  kind: 'Or'
  conditions: Condition[]
}

export interface NotCondition {
  kind: 'Not'
  condition: UnboundPattern | EvalCondition | RawCondition
}

export interface ExistsCondition {
  kind: 'Exists'
  condition: UnboundPattern | EvalCondition | RawCondition
}

export interface ForallCondition {
  kind: 'Forall'
  condition: Condition  // forall() does allow binding
}

export interface AccumulateFunction {
  binding: string        // e.g. $total
  function: string       // sum | count | min | max | average
  argument: string       // raw expression e.g. $score
}

export interface AccumulatePattern {
  kind: 'Accumulate'
  source: Condition
  functions: AccumulateFunction[]
  resultConstraint?: string  // e.g. "$total > 50"
}

export interface FromCondition {
  kind: 'From'
  pattern: FactPattern
  expression: string     // the 'from' source — collection, method call, etc.
}

export interface EvalCondition {
  kind: 'Eval'
  expression: string
}

export interface RawCondition {
  kind: 'RawCondition'
  drl: string            // verbatim — emitted as-is by MetaToDRLTransformer
}

export type Condition =
  | FactPattern
  | UnboundPattern
  | AndCondition
  | OrCondition
  | NotCondition
  | ExistsCondition
  | ForallCondition
  | AccumulatePattern
  | FromCondition
  | EvalCondition
  | RawCondition

// ─── CONSEQUENCE (RHS) ────────────────────────────────────────────────────────

export interface Modification {
  method: string
  args: string[]
}

export interface ModifyConsequence {
  kind: 'ModifyConsequence'
  binding: string
  modifications: Modification[]
}

export interface InsertConsequence {
  kind: 'InsertConsequence'
  objectExpression: string
}

export interface RetractConsequence {
  kind: 'RetractConsequence'
  binding: string
}

export interface SetGlobalConsequence {
  kind: 'SetGlobalConsequence'
  expression: string
}

export interface RawConsequence {
  kind: 'RawConsequence'
  code: string           // verbatim — emitted as-is by MetaToDRLTransformer
}

export type Consequence =
  | ModifyConsequence
  | InsertConsequence
  | RetractConsequence
  | SetGlobalConsequence
  | RawConsequence

// ─── RULE & FILE ──────────────────────────────────────────────────────────────

export interface Rule {
  name: string
  salience?: number
  agendaGroup?: string
  noLoop?: boolean
  lockOnActive?: boolean
  ruleFlowGroup?: string
  conditions: Condition[]   // top-level list — implicitly AND-ed
  consequences: Consequence[]
}

export interface DroolsFile {
  name: string
  imports: string[]
  rules: Rule[]
}
