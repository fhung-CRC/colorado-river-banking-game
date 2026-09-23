import { describe, expect, it } from 'vitest'
import { allocateInflow, defaultConfig, proRataWithdraw, runYear } from '../src/simulation/model'

describe('allocation',()=>{
  it('uses seniority and sends excess to system storage',()=>{
    expect(allocateInflow(3)).toEqual({allocationA:3,allocationB:0,systemAllocation:0})
    expect(allocateInflow(7)).toEqual({allocationA:5,allocationB:2,systemAllocation:0})
    expect(allocateInflow(15)).toEqual({allocationA:5,allocationB:5,systemAllocation:5})
  })
})

describe('withdrawals',()=>{
  it('shares constrained storage pro rata',()=>{
    const r=proRataWithdraw({A:4,B:2,SO:1},{A:3,B:1},5)
    expect(r.A).toBeCloseTo(1.5)
    expect(r.B).toBeCloseTo(0.5)
  })
  it('blocks withdrawals at the infrastructure floor',()=>{
    expect(proRataWithdraw({A:2,B:2,SO:1},{A:1,B:1},5)).toEqual({A:0,B:0})
  })
})

describe('accounting',()=>{
  it('balances every acre-foot in a representative year',()=>{
    const r=runYear(1,{A:2,B:1,SO:1},12,70,{conserveA:1,conserveB:2,requestWithdrawA:0,requestWithdrawB:2})
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-9)
    expect(r.totalStorage).toBeLessThanOrEqual(defaultConfig.reservoirCapacity)
  })
})
