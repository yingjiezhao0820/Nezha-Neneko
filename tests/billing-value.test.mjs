import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// 只加载 utils.ts 中独立的账单声明，避免 Node 测试加载浏览器/RPC 依赖。
// 使用实际源码编译，不在测试里复制计算逻辑。
const source = readFileSync(new URL("../src/lib/utils.ts", import.meta.url), "utf8")
const ast = ts.createSourceFile("utils.ts", source, ts.ScriptTarget.Latest, true)
const billingNames = new Set([
  "BillingData",
  "BILLING_DAY_MS",
  "BILLING_LONG_TERM_DAYS",
  "parseChineseBillingNumeral",
  "parseBillingCycleDays",
  "calculateRemainingBillingValue",
])
const declarations = ast.statements.filter((statement) => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((declaration) => billingNames.has(declaration.name.getText(ast)))
  }
  return statement.name && billingNames.has(statement.name.getText(ast))
})
const { outputText } = ts.transpileModule(declarations.map((statement) => statement.getText(ast)).join("\n"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const exports = {}
runInNewContext(outputText, { exports })
const { calculateRemainingBillingValue, parseBillingCycleDays } = exports

const billing = {
  startDate: "2026-09-20T00:00:00Z",
  endDate: "2026-12-20T00:00:00Z",
  autoRenewal: "0",
  cycle: "月",
  amount: "115.01",
  currency: "HKD",
}

function calculate(overrides = {}, atDate = "2026-10-09T00:00:00Z", amount = 115.01) {
  return calculateRemainingBillingValue({ ...billing, ...overrides }, amount, new Date(atDate))
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, received ${actual}`)
}

test("月付预付多个周期：72 天价值为 2.4 个月，不截断为一个月", () => {
  const remaining = calculate()
  assert.equal(remaining.days, 72)
  closeTo(remaining.value, 115.01 * 72 / 30)
  assert.equal(remaining.isExpired, false)
  // 按用户示例一个月换算为 ¥98.42，72 天应约为 ¥236.21。
  const hkdPerCny = 115.01 / 98.42
  assert.equal((remaining.value / hkdPerCny).toFixed(2), "236.21")
})

test("单周期内仍按实际剩余时间折算", () => {
  const remaining = calculate({}, "2026-12-05T12:00:00Z")
  assert.equal(remaining.days, 15)
  closeTo(remaining.value, 115.01 * 14.5 / 30)
})

test("年付预付多个周期也不截断", () => {
  const remaining = calculate({ cycle: "年", endDate: "2028-10-08T00:00:00Z" })
  assert.equal(remaining.days, 730)
  closeTo(remaining.value, 115.01 * 2)
})

test("多年计费周期保持正确的分母", () => {
  const remaining = calculate({ cycle: "五年", endDate: "2027-10-09T00:00:00Z" })
  closeTo(remaining.value, 115.01 / 5)
  assert.equal(parseBillingCycleDays("5年"), 1825)
  assert.equal(parseBillingCycleDays("五年"), 1825)
})

for (const atDate of ["2026-12-20T00:00:00Z", "2026-12-21T00:00:00Z"]) {
  test(`到期不自动续费时剩余价值归零：${atDate}`, () => {
    const remaining = calculate({}, atDate)
    assert.equal(remaining.value, 0)
    assert.equal(remaining.isExpired, true)
  })
}

test("自动续费仍推进到下一个周期", () => {
  const remaining = calculate({ autoRenewal: "1" }, "2026-12-25T00:00:00Z")
  assert.equal(remaining.days, 25)
  closeTo(remaining.value, 115.01 * 25 / 30)
  assert.equal(remaining.isExpired, false)
})

for (const endDate of ["", "0000-00-00T00:00:00Z", "2200-01-01T00:00:00Z"]) {
  test(`无到期时间或长期套餐保持原价：${endDate || "未设置"}`, () => {
    const remaining = calculate({ endDate })
    assert.equal(remaining.value, 115.01)
    assert.equal(remaining.days, null)
    assert.equal(remaining.isLongTerm, endDate !== "")
  })
}

for (const amount of [0, -1]) {
  test(`未设置价格/免费不贡献剩余价值：${amount}`, () => {
    assert.equal(calculate({}, undefined, amount).value, 0)
  })
}

test("无可用计费周期仍保留原价", () => {
  assert.equal(calculate({ cycle: "一次性", startDate: "" }).value, 115.01)
})

test("无效到期时间不产生剩余价值", () => {
  const remaining = calculate({ endDate: "invalid" })
  assert.equal(remaining.value, 0)
  assert.equal(remaining.days, null)
})
