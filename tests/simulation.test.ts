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


describe('Toy 3 risk and water security',()=>{
  it('uses piecewise nonlinear marginal costs',async()=>{
    const { marginalCurveCost }=await import('../src/simulation/riskModel')
    const curve={breaks:[0.5,1,2],costs:[30,60,120]}
    expect(marginalCurveCost(0.2,curve)).toBe(30)
    expect(marginalCurveCost(0.7,curve)).toBe(60)
    expect(marginalCurveCost(1.4,curve)).toBe(120)
  })

  it('raises lost-security cost as storage coverage falls',async()=>{
    const { securityMarginalCost }=await import('../src/simulation/riskModel')
    const costs=[20,60,140,300,700]
    expect(securityMarginalCost(4,4,costs)).toBe(20)
    expect(securityMarginalCost(3.5,4,costs)).toBe(60)
    expect(securityMarginalCost(2.5,4,costs)).toBe(140)
    expect(securityMarginalCost(1.5,4,costs)).toBe(300)
    expect(securityMarginalCost(0.5,4,costs)).toBe(700)
  })

  it('can switch strategies when marginal curves cross',async()=>{
    const { optimizeShortage }=await import('../src/simulation/riskModel')
    const reduction={breaks:[0.5,1,2],costs:[20,120,300]}
    const supplemental={breaks:[0.5,1,2],costs:[80,90,200]}
    const p=optimizeShortage(1.5,0,0,reduction,supplemental,0,[0,0,0,0,0],0.5)
    expect(p.reduction).toBeCloseTo(0.5)
    expect(p.supplemental).toBeCloseTo(1)
  })

  it('preserves banked water when lost-security cost exceeds alternatives',async()=>{
    const { optimizeShortage }=await import('../src/simulation/riskModel')
    const reduction={breaks:[5],costs:[100]}
    const supplemental={breaks:[5],costs:[120]}
    const p=optimizeShortage(1,2,2,reduction,supplemental,2,[20,200,400,700,1000],0.5)
    expect(p.bankWithdrawal).toBeCloseTo(0)
    expect(p.reduction).toBeCloseTo(1)
  })

  it('maintains physical and water-balance constraints in a risk year',async()=>{
    const { runRiskYear, defaultToy3Config }=await import('../src/simulation/riskModel')
    const r=runRiskYear(1,{A:4,B:3,Fed:1},6,defaultToy3Config)
    expect(r.totalStorage).toBeLessThanOrEqual(defaultConfig.reservoirCapacity+1e-9)
    expect(r.totalStorage).toBeGreaterThanOrEqual(defaultConfig.infrastructureFloor-1e-9)
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-8)
  })
})
