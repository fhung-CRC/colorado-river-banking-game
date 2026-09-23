import { describe, expect, it } from 'vitest'
import { allocateInflow, defaultConfig, proRataWithdraw, runYear } from '../src/simulation/model'

const decision=(overrides={})=>({
  conserveA:0,conserveB:0,
  requestWithdrawA:0,requestWithdrawB:0,
  requestSupplementalA:0,requestSupplementalB:0,
  fedRegulationRelease:0,fedEnvironmentalRelease:0,
  ...overrides
})

describe('allocation',()=>{
  it('uses seniority and sends excess to the federal account',()=>{
    expect(allocateInflow(3)).toEqual({allocationA:3,allocationB:0,federalAllocation:0})
    expect(allocateInflow(7)).toEqual({allocationA:5,allocationB:2,federalAllocation:0})
    expect(allocateInflow(15)).toEqual({allocationA:5,allocationB:5,federalAllocation:5})
  })
})

describe('withdrawals',()=>{
  it('shares constrained storage pro rata including Fed releases',()=>{
    const r=proRataWithdraw({A:4,B:2,Fed:1},{A:3,B:1,Fed:1},5)
    expect(r.A).toBeCloseTo(1.2)
    expect(r.B).toBeCloseTo(0.4)
    expect(r.Fed).toBeCloseTo(0.4)
  })
  it('blocks withdrawals at the infrastructure floor',()=>{
    expect(proRataWithdraw({A:2,B:2,Fed:1},{A:1,B:1,Fed:1},5)).toEqual({A:0,B:0,Fed:0})
  })
})

describe('accounting',()=>{
  it('balances every acre-foot in a representative year',()=>{
    const r=runYear(1,{A:2,B:1,Fed:1},12,decision({conserveA:1,conserveB:2,requestWithdrawB:2}))
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-9)
    expect(r.totalStorage).toBeLessThanOrEqual(defaultConfig.reservoirCapacity)
  })

  it('does not allow a same-year deposit to create withdrawal liquidity',()=>{
    const r=runYear(1,{A:0,B:0,Fed:5},5,decision({conserveA:2,requestWithdrawA:2}))
    expect(r.depositA).toBeCloseTo(2)
    expect(r.actualWithdrawA).toBe(0)
    expect(r.reductionA).toBeCloseTo(2)
  })

  it('uses configurable supplemental and reduction costs',()=>{
    const c={...defaultConfig,reductionCostA:90,reductionCostB:30,supplementalCost:60}
    const r=runYear(1,{A:0,B:0,Fed:5},3,decision({requestSupplementalA:1}),c)
    expect(r.supplementalA).toBeCloseTo(1)
    expect(r.reductionA).toBeCloseTo(1)
    expect(r.costA).toBeCloseTo(150)
  })

  it('lets Fed release previously banked water for regulation and environmental benefits',()=>{
    const r=runYear(1,{A:2,B:2,Fed:4},10,decision({fedRegulationRelease:1,fedEnvironmentalRelease:0.5}))
    expect(r.actualFedRegulationRelease).toBeCloseTo(1)
    expect(r.actualFedEnvironmentalRelease).toBeCloseTo(0.5)
    expect(r.endBalances.Fed).toBeCloseTo(2.5)
    expect(r.totalStorage).toBeGreaterThanOrEqual(defaultConfig.infrastructureFloor)
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-9)
  })

  it('pro-rates Fed purposes when the floor constrains total stored-water releases',()=>{
    const r=runYear(1,{A:3,B:2,Fed:2},3,decision({
      requestWithdrawA:2,
      fedRegulationRelease:1,
      fedEnvironmentalRelease:1
    }))
    expect(r.actualWithdrawA).toBeCloseTo(1)
    expect(r.actualFedRegulationRelease).toBeCloseTo(0.5)
    expect(r.actualFedEnvironmentalRelease).toBeCloseTo(0.5)
    expect(r.totalStorage).toBeGreaterThanOrEqual(defaultConfig.infrastructureFloor)
  })
})
