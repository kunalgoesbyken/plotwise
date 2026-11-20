import { describe, expect, it } from 'bun:test'
import { scenarioReport } from './report'
import { SCENARIOS } from './scenarios'

describe('Bangkok results stay byte-identical across engine refactors', () => {
  for (const { name, plot, farMode } of SCENARIOS) {
    it(name, () => {
      expect(scenarioReport(plot, farMode)).toMatchSnapshot()
    })
  }
})
