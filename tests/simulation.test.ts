import { describe, expect, it } from 'vitest'
import { allocateInflow, defaultConfig, proRataWithdraw, runYear } from '../src/simulation/model'

describe('allocation',()=>{
  it('uses seniority and sends excess to the federal account',()=>{
    expect(allocateInflow(3)).toEqual({allocationA:3,allocationB:0,federalAllocation:0})
    expect(allocateInflow(7)).toEqual({allocationA:5,allocationB:2,federalAllocation:0})
    expect(allocateInflow(15)).toEqual({allocationA:5,allocationB:5,federalAllocation:5})
  })
})

describe('withdrawals',()=>{
  it('shares constrained storage pro rata',()=>{
    const r=proRataWithdraw({A:4,B:2,Fed:1},{A:3,B:1},5)
    expect(r.A).toBeCloseTo(1.5)
    expect(r.B).toBeCloseTo(0.5)
  })
  it('blocks withdrawals at the infrastructure floor',()=>{
    expect(proRataWithdraw({A:2,B:2,Fed:1},{A:1,B:1},5)).toEqual({A:0,B:0})
  })
})

describe('accounting',()=>{
  it('balances every acre-foot in a representative year',()=>{
    const r=runYear(1,{A:2,B:1,Fed:1},12,{
      conserveA:1,conserveB:2,
      requestWithdrawA:0,requestWithdrawB:2,
      requestSupplementalA:0,requestSupplementalB:0
    })
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-9)
    expect(r.totalStorage).toBeLessThanOrEqual(defaultConfig.reservoirCapacity)
  })

  it('does not allow a same-year deposit to be immediately withdrawn',()=>{
    const r=runYear(1,{A:0,B:0,Fed:5},5,{
      conserveA:2,conserveB:0,
      requestWithdrawA:2,requestWithdrawB:0,
      requestSupplementalA:0,requestSupplementalB:0
    })
    expect(r.depositA).toBeCloseTo(2)
    expect(r.actualWithdrawA).toBe(0)
    expect(r.reductionA).toBeCloseTo(2)
  })

  it('uses configurable supplemental and reduction costs',()=>{
    const c={...defaultConfig,reductionCostA:90,reductionCostB:30,supplementalCost:60}
    const r=runYear(1,{A:0,B:0,Fed:5},3,{
      conserveA:0,conserveB:0,
      requestWithdrawA:0,requestWithdrawB:0,
      requestSupplementalA:1,requestSupplementalB:0
    },c)
    expect(r.supplementalA).toBeCloseTo(1)
    expect(r.reductionA).toBeCloseTo(1)
    expect(r.costA).toBeCloseTo(150)
  })
})
