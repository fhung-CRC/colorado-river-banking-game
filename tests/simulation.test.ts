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
  it('uses seniority and sends excess to the federal account by default',()=>{
    expect(allocateInflow(3)).toEqual({allocationA:3,allocationB:0,federalAllocation:0})
    expect(allocateInflow(7)).toEqual({allocationA:5,allocationB:2,federalAllocation:0})
    expect(allocateInflow(15)).toEqual({allocationA:5,allocationB:5,federalAllocation:5})
  })

  it('can distribute excess inflow pro rata to A and B',()=>{
    const c={...defaultConfig,excessAllocationMode:'proRata' as const}
    expect(allocateInflow(15,c)).toEqual({allocationA:7.5,allocationB:7.5,federalAllocation:0})
  })

  it('uses annual-right shares for pro-rata excess allocation',()=>{
    const c={...defaultConfig,annualRightA:6,annualRightB:4,excessAllocationMode:'proRata' as const}
    expect(allocateInflow(15,c)).toEqual({allocationA:9,allocationB:6,federalAllocation:0})
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

  it('does not transfer an unstorable pro-rata excess share to the other player',()=>{
    const c={...defaultConfig,excessAllocationMode:'proRata' as const}
    const r=runYear(1,{A:10,B:0,Fed:0},14,decision(),c)
    expect(r.allocationA).toBeCloseTo(7)
    expect(r.allocationB).toBeCloseTo(7)
    expect(r.depositA).toBeCloseTo(0)
    expect(r.depositB).toBeCloseTo(2)
    expect(r.spill).toBeCloseTo(2)
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-9)
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

  it('generates a fixed security-value curve from shortage and failure preferences',async()=>{
    const {
      generateSecurityValueCurve, defaultReductionCurveA, defaultSupplementalCurve
    }=await import('../src/simulation/riskModel')
    const curve=generateSecurityValueCurve(
      'A',{criticalShortage:1.5,failureTolerance:0.05},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    expect(curve.points.length).toBeGreaterThan(10)
    expect(curve.preference.criticalShortage).toBe(1.5)
    expect(curve.preference.failureTolerance).toBe(0.05)
    expect(curve.points.every(p=>p.marginalValue>=0)).toBe(true)
  })

  it('tighter failure tolerance does not reduce the constrained expected cost at zero storage',async()=>{
    const {
      generateSecurityValueCurve, defaultReductionCurveA, defaultSupplementalCurve
    }=await import('../src/simulation/riskModel')
    const loose=generateSecurityValueCurve(
      'A',{criticalShortage:1.5,failureTolerance:0.20},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    const tight=generateSecurityValueCurve(
      'A',{criticalShortage:1.5,failureTolerance:0.05},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    expect(tight.points[0].expectedCost).toBeGreaterThanOrEqual(loose.points[0].expectedCost-1e-9)
  })

  it('produces non-increasing constrained expected cost as storage increases',async()=>{
    const {
      generateSecurityValueCurve, defaultReductionCurveA, defaultSupplementalCurve
    }=await import('../src/simulation/riskModel')
    const curve=generateSecurityValueCurve(
      'A',{criticalShortage:1.5,failureTolerance:0.05},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    for(let i=1;i<curve.points.length;i++){
      expect(curve.points[i].expectedCost).toBeLessThanOrEqual(curve.points[i-1].expectedCost+1e-9)
    }
  })

  it('requires at least as much reliability storage when failure tolerance tightens',async()=>{
    const {
      generateSecurityValueCurve, defaultReductionCurveA, defaultSupplementalCurve
    }=await import('../src/simulation/riskModel')
    const loose=generateSecurityValueCurve(
      'A',{criticalShortage:1.5,failureTolerance:0.20},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    const tight=generateSecurityValueCurve(
      'A',{criticalShortage:1.5,failureTolerance:0.05},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    expect(tight.reliabilityStorage).toBeGreaterThanOrEqual(loose.reliabilityStorage-1e-9)
  })

  it('does not make stricter shortage protection cheaper at zero storage',async()=>{
    const {
      generateSecurityValueCurve, defaultReductionCurveA, defaultSupplementalCurve
    }=await import('../src/simulation/riskModel')
    const lenient=generateSecurityValueCurve(
      'A',{criticalShortage:2.5,failureTolerance:0.05},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    const strict=generateSecurityValueCurve(
      'A',{criticalShortage:1.0,failureTolerance:0.05},
      defaultReductionCurveA,defaultSupplementalCurve
    )
    expect(strict.points[0].expectedCost).toBeGreaterThanOrEqual(lenient.points[0].expectedCost-1e-9)
    expect(strict.reliabilityStorage).toBeGreaterThanOrEqual(lenient.reliabilityStorage-1e-9)
  })

  it('can switch strategies when marginal curves cross',async()=>{
    const {
      optimizeShortage, generateSecurityValueCurve
    }=await import('../src/simulation/riskModel')
    const reduction={breaks:[0.5,1,2],costs:[20,120,300]}
    const supplemental={breaks:[0.5,1,2],costs:[80,90,200]}
    const security=generateSecurityValueCurve(
      'A',{criticalShortage:5,failureTolerance:0.5},
      reduction,supplemental
    )
    const p=optimizeShortage(1.5,0,0,reduction,supplemental,security,0.5)
    expect(p.reduction).toBeCloseTo(0.5)
    expect(p.supplemental).toBeCloseTo(1)
  })

  it('uses the generated security value as an opportunity cost of bank withdrawal',async()=>{
    const {
      optimizeShortage, generateSecurityValueCurve
    }=await import('../src/simulation/riskModel')
    const reduction={breaks:[5],costs:[100]}
    const supplemental={breaks:[5],costs:[120]}
    const security=generateSecurityValueCurve(
      'A',{criticalShortage:0.2,failureTolerance:0},
      reduction,supplemental
    )
    const p=optimizeShortage(1,2,2,reduction,supplemental,security,0.25)
    expect(p.decisionCost).toBeCloseTo(p.cashCost+p.securityCost)
    expect(p.bankWithdrawal+p.reduction+p.supplemental).toBeCloseTo(1)
  })

  it('banks pro-rata excess with A and B instead of the Fed in Toy 3',async()=>{
    const { runRiskYear, buildToy3Config }=await import('../src/simulation/riskModel')
    const c={...defaultConfig,excessAllocationMode:'proRata' as const}
    const t=buildToy3Config(undefined,undefined,undefined,undefined,undefined,c)
    const r=runRiskYear(1,{A:0,B:0,Fed:0},14,t,c)
    expect(r.federalAllocation).toBeCloseTo(0)
    expect(r.surplusDepositA).toBeCloseTo(2)
    expect(r.surplusDepositB).toBeCloseTo(2)
    expect(r.depositFed).toBeCloseTo(0)
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-8)
  })

  it('maintains physical and water-balance constraints in a risk year',async()=>{
    const { runRiskYear, defaultToy3Config }=await import('../src/simulation/riskModel')
    const r=runRiskYear(1,{A:4,B:3,Fed:1},6,defaultToy3Config)
    expect(r.totalStorage).toBeLessThanOrEqual(defaultConfig.reservoirCapacity+1e-9)
    expect(r.totalStorage).toBeGreaterThanOrEqual(defaultConfig.infrastructureFloor-1e-9)
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-8)
  })

  it('returns rejected A/B security deposits to use instead of counting them as spill',async()=>{
    const { runRiskYear, buildToy3Config }=await import('../src/simulation/riskModel')
    const c={...defaultConfig,reservoirCapacity:10,bankLimitA:10,bankLimitB:10,bankLimitFed:5}
    const t=buildToy3Config(
      {criticalShortage:0,failureTolerance:0},
      {criticalShortage:0,failureTolerance:0},
      {breaks:[5],costs:[1]},
      {breaks:[5],costs:[1]},
      {breaks:[5],costs:[1000]},
      c
    )
    const r=runRiskYear(1,{A:4.9,B:4.9,Fed:0},10,t,c)
    expect(r.totalStorage).toBeLessThanOrEqual(10+1e-9)
    expect(Math.abs(r.waterBalanceError)).toBeLessThan(1e-8)
  })
})
