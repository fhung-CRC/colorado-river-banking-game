import { allocateInflow, defaultConfig, proRataWithdraw } from './model'
import type { Balances, SimulationConfig } from './types'
import type {
  MarginalCurve, PlayerRiskPlan, RiskYearResult, SecurityPreference,
  SecurityValueCurve, SecurityValuePoint, Toy3Config
} from './riskTypes'

export const defaultReductionCurveA:MarginalCurve={
  breaks:[0.5,1,2,3,5],
  costs:[30,60,120,250,600]
}
export const defaultReductionCurveB:MarginalCurve={
  breaks:[0.5,1,2,3,5],
  costs:[20,40,80,180,500]
}
export const defaultSupplementalCurve:MarginalCurve={
  breaks:[0.5,1,1.5,2,5],
  costs:[60,90,140,220,800]
}

export const defaultPreferenceA:SecurityPreference={criticalShortage:1.5,failureTolerance:0.05}
export const defaultPreferenceB:SecurityPreference={criticalShortage:2.0,failureTolerance:0.10}

export function marginalCurveCost(quantityUsed:number,curve:MarginalCurve){
  for(let i=0;i<curve.breaks.length;i++){
    if(quantityUsed<curve.breaks[i]-1e-9) return Math.max(0,curve.costs[i]??0)
  }
  return Math.max(0,curve.costs[curve.costs.length-1]??0)
}

function optimizeCashResponse(
  shortage:number,
  reductionCurve:MarginalCurve,
  supplementalCurve:MarginalCurve,
  maxReduction=Infinity,
  step=0.05
){
  let remaining=Math.max(0,shortage)
  let reduction=0
  let supplemental=0
  let cost=0
  while(remaining>1e-9){
    const q=Math.min(step,remaining)
    const reductionAllowed=reduction+q<=maxReduction+1e-9
    const rCost=reductionAllowed?marginalCurveCost(reduction,reductionCurve):Infinity
    const sCost=marginalCurveCost(supplemental,supplementalCurve)
    if(rCost<=sCost){
      reduction+=q
      cost+=q*rCost
    }else{
      supplemental+=q
      cost+=q*sCost
    }
    remaining-=q
  }
  return {reduction,supplemental,cost}
}

export function generateSecurityValueCurve(
  player:'A'|'B',
  preference:SecurityPreference,
  reductionCurve:MarginalCurve,
  supplementalCurve:MarginalCurve,
  c:SimulationConfig=defaultConfig,
  storageStep=0.25,
  scenarioCount=261
):SecurityValueCurve{
  const limit=player==='A'?c.bankLimitA:c.bankLimitB
  const demand=player==='A'?c.demandA:c.demandB
  const epsilon=Math.min(0.5,Math.max(0,preference.failureTolerance))
  const critical=Math.max(0,preference.criticalShortage)
  const points:SecurityValuePoint[]=[]

  for(let storage=0;storage<=limit+1e-9;storage+=storageStep){
    const scenarios:{baseCost:number;protectedCost:number;baseViolation:boolean}[]=[]
    // Equally weighted stationary inflow outcomes across the configured range.
    for(let k=0;k<scenarioCount;k++){
      const inflow=c.inflowMin+(c.inflowMax-c.inflowMin)*(k/(scenarioCount-1))
      const a=allocateInflow(inflow,c)
      const allocation=player==='A'?a.allocationA:a.allocationB
      const rawShortage=Math.max(0,demand-allocation)
      const residual=Math.max(0,rawShortage-Math.min(storage,rawShortage))
      const base=optimizeCashResponse(residual,reductionCurve,supplementalCurve,Infinity,0.05)
      const protectedPlan=optimizeCashResponse(residual,reductionCurve,supplementalCurve,critical,0.05)
      scenarios.push({
        baseCost:base.cost,
        protectedCost:protectedPlan.cost,
        baseViolation:base.reduction>critical+1e-9
      })
    }

    const violating=scenarios
      .map((s,i)=>({i,increment:Math.max(0,s.protectedCost-s.baseCost),violation:s.baseViolation}))
      .filter(x=>x.violation)
      .sort((a,b)=>a.increment-b.increment)

    const allowedViolations=Math.floor(epsilon*scenarioCount+1e-9)
    const mustProtect=Math.max(0,violating.length-allowedViolations)
    const protectedSet=new Set(violating.slice(0,mustProtect).map(x=>x.i))
    let total=0
    for(let i=0;i<scenarios.length;i++){
      total+=protectedSet.has(i)?scenarios[i].protectedCost:scenarios[i].baseCost
    }
    const baseFailureProbability=violating.length/scenarioCount
    const constrainedFailureProbability=Math.max(0,violating.length-mustProtect)/scenarioCount
    points.push({
      storage:Number(storage.toFixed(6)),
      expectedCost:total/scenarioCount,
      baseFailureProbability,
      constrainedFailureProbability,
      marginalValue:0
    })
  }

  for(let i=0;i<points.length;i++){
    if(i===points.length-1){
      points[i].marginalValue=i>0?points[i-1].marginalValue:0
    }else{
      const ds=points[i+1].storage-points[i].storage
      points[i].marginalValue=Math.max(0,(points[i].expectedCost-points[i+1].expectedCost)/ds)
    }
  }

  const reliabilityPoint=points.find(p=>p.baseFailureProbability<=epsilon+1e-9)
  const reliabilityStorage=reliabilityPoint?.storage??limit
  const breaks=points.slice(1).map(p=>p.storage)
  const costs=points.slice(0,-1).map(p=>p.marginalValue)
  if(costs.length===0){ breaks.push(limit); costs.push(0) }

  return {
    breaks,costs,points,reliabilityStorage,
    reliabilityAchieved:!!reliabilityPoint,
    preference:{criticalShortage:critical,failureTolerance:epsilon}
  }
}

export function securityMarginalCost(remainingBank:number,curve:SecurityValueCurve){
  const s=Math.max(0,remainingBank)
  for(let i=0;i<curve.breaks.length;i++){
    if(s<curve.breaks[i]-1e-9) return Math.max(0,curve.costs[i]??0)
  }
  return 0
}

export function buildToy3Config(
  preferenceA:SecurityPreference=defaultPreferenceA,
  preferenceB:SecurityPreference=defaultPreferenceB,
  reductionCurveA:MarginalCurve=defaultReductionCurveA,
  reductionCurveB:MarginalCurve=defaultReductionCurveB,
  supplementalCurve:MarginalCurve=defaultSupplementalCurve,
  c:SimulationConfig=defaultConfig
):Toy3Config{
  return {
    step:0.1,
    reductionCurveA,reductionCurveB,supplementalCurve,
    securityPreferenceA:preferenceA,
    securityPreferenceB:preferenceB,
    securityCurveA:generateSecurityValueCurve('A',preferenceA,reductionCurveA,supplementalCurve,c),
    securityCurveB:generateSecurityValueCurve('B',preferenceB,reductionCurveB,supplementalCurve,c)
  }
}

export const defaultToy3Config=buildToy3Config()

function chooseCheapest(candidates:{kind:'bank'|'supplemental'|'reduction';cost:number}[]){
  return [...candidates].sort((a,b)=>a.cost-b.cost || order(a.kind)-order(b.kind))[0]
}

function order(kind:'bank'|'supplemental'|'reduction'){
  if(kind==='reduction') return 0
  if(kind==='supplemental') return 1
  return 2
}

export function optimizeShortage(
  shortage:number,
  openingBank:number,
  bankWithdrawalCap:number,
  reductionCurve:MarginalCurve,
  supplementalCurve:MarginalCurve,
  securityCurve:SecurityValueCurve,
  step:number
):PlayerRiskPlan{
  let remaining=Math.max(0,shortage)
  let bankWithdrawal=0
  let supplemental=0
  let reduction=0
  let cashCost=0
  let securityCost=0

  while(remaining>1e-9){
    const q=Math.min(step,remaining)
    const candidates:{kind:'bank'|'supplemental'|'reduction';cost:number}[]=[
      {kind:'reduction',cost:marginalCurveCost(reduction,reductionCurve)},
      {kind:'supplemental',cost:marginalCurveCost(supplemental,supplementalCurve)}
    ]
    if(bankWithdrawal+q<=Math.min(openingBank,bankWithdrawalCap)+1e-9){
      candidates.push({
        kind:'bank',
        cost:securityMarginalCost(openingBank-bankWithdrawal-q,securityCurve)
      })
    }

    const choice=chooseCheapest(candidates)
    if(choice.kind==='bank'){
      bankWithdrawal+=q
      securityCost+=q*choice.cost
    }else if(choice.kind==='supplemental'){
      supplemental+=q
      cashCost+=q*choice.cost
    }else{
      reduction+=q
      cashCost+=q*choice.cost
    }
    remaining-=q
  }

  return {
    bankWithdrawal,supplemental,reduction,
    securityDeposit:0,depositViaReduction:0,depositViaSupplemental:0,
    cashCost,securityCost,decisionCost:cashCost+securityCost
  }
}

export function addSecurityInvestment(
  base:PlayerRiskPlan,
  bankAfterWithdrawal:number,
  accountLimit:number,
  physicalSpace:number,
  reductionCurve:MarginalCurve,
  supplementalCurve:MarginalCurve,
  securityCurve:SecurityValueCurve,
  step:number
):PlayerRiskPlan{
  const plan={...base}
  let bank=bankAfterWithdrawal
  let remainingSpace=Math.max(0,physicalSpace)

  while(bank+1e-9<accountLimit && remainingSpace>1e-9){
    const q=Math.min(step,accountLimit-bank,remainingSpace)
    if(q<=1e-9) break
    const securityBenefit=securityMarginalCost(bank,securityCurve)
    const reductionCost=marginalCurveCost(plan.reduction,reductionCurve)
    const supplementalCost=marginalCurveCost(plan.supplemental,supplementalCurve)
    const fundingCost=Math.min(reductionCost,supplementalCost)
    if(fundingCost+1e-9>=securityBenefit) break

    plan.securityDeposit+=q
    if(reductionCost<=supplementalCost){
      plan.reduction+=q
      plan.depositViaReduction+=q
      plan.cashCost+=q*reductionCost
    }else{
      plan.supplemental+=q
      plan.depositViaSupplemental+=q
      plan.cashCost+=q*supplementalCost
    }
    bank+=q
    remainingSpace-=q
  }
  plan.decisionCost=plan.cashCost+plan.securityCost
  return plan
}

function prorateDeposits(requested:{A:number;B:number;Fed:number},space:number){
  const total=requested.A+requested.B+requested.Fed
  if(total<=space+1e-9) return requested
  if(total<=1e-9||space<=1e-9) return {A:0,B:0,Fed:0}
  const f=space/total
  return {A:requested.A*f,B:requested.B*f,Fed:requested.Fed*f}
}

function coverage(bank:number,target:number){
  if(target<=1e-9) return 1
  return bank/target
}

export function runRiskYear(
  year:number,
  start:Balances,
  inflow:number,
  t:Toy3Config=defaultToy3Config,
  c:SimulationConfig=defaultConfig
):RiskYearResult{
  const {allocationA,allocationB,federalAllocation}=allocateInflow(inflow,c)
  const shortageA=Math.max(0,c.demandA-allocationA)
  const shortageB=Math.max(0,c.demandB-allocationB)

  const desiredA=optimizeShortage(
    shortageA,start.A,start.A,t.reductionCurveA,t.supplementalCurve,t.securityCurveA,t.step
  )
  const desiredB=optimizeShortage(
    shortageB,start.B,start.B,t.reductionCurveB,t.supplementalCurve,t.securityCurveB,t.step
  )

  const allowed=proRataWithdraw(
    start,
    {A:desiredA.bankWithdrawal,B:desiredB.bankWithdrawal,Fed:0},
    c.infrastructureFloor
  )

  let planA=optimizeShortage(
    shortageA,start.A,allowed.A,t.reductionCurveA,t.supplementalCurve,t.securityCurveA,t.step
  )
  let planB=optimizeShortage(
    shortageB,start.B,allowed.B,t.reductionCurveB,t.supplementalCurve,t.securityCurveB,t.step
  )

  const afterWithdrawA=start.A-planA.bankWithdrawal
  const afterWithdrawB=start.B-planB.bankWithdrawal
  const afterWithdrawFed=start.Fed
  const storageAfterWithdraw=afterWithdrawA+afterWithdrawB+afterWithdrawFed

  if(allocationA>=c.demandA-1e-9){
    planA=addSecurityInvestment(
      planA,afterWithdrawA,c.bankLimitA,c.reservoirCapacity,
      t.reductionCurveA,t.supplementalCurve,t.securityCurveA,t.step
    )
  }
  if(allocationB>=c.demandB-1e-9){
    planB=addSecurityInvestment(
      planB,afterWithdrawB,c.bankLimitB,c.reservoirCapacity,
      t.reductionCurveB,t.supplementalCurve,t.securityCurveB,t.step
    )
  }

  const reqDepA=Math.min(planA.securityDeposit,Math.max(0,c.bankLimitA-afterWithdrawA))
  const reqDepB=Math.min(planB.securityDeposit,Math.max(0,c.bankLimitB-afterWithdrawB))
  const reqDepFed=Math.min(federalAllocation,Math.max(0,c.bankLimitFed-afterWithdrawFed))
  const physicalSpace=Math.max(0,c.reservoirCapacity-storageAfterWithdraw)
  const accepted=prorateDeposits({A:reqDepA,B:reqDepB,Fed:reqDepFed},physicalSpace)

  const scaleA=reqDepA>1e-9?accepted.A/reqDepA:0
  const scaleB=reqDepB>1e-9?accepted.B/reqDepB:0
  const actualSecurityDepositA=accepted.A
  const actualSecurityDepositB=accepted.B
  const actualDepViaReductionA=planA.depositViaReduction*scaleA
  const actualDepViaReductionB=planB.depositViaReduction*scaleB
  const actualDepViaSupplementalA=planA.depositViaSupplemental*scaleA
  const actualDepViaSupplementalB=planB.depositViaSupplemental*scaleB

  const rejectedReductionA=planA.depositViaReduction-actualDepViaReductionA
  const rejectedReductionB=planB.depositViaReduction-actualDepViaReductionB
  const rejectedSupplementalA=planA.depositViaSupplemental-actualDepViaSupplementalA
  const rejectedSupplementalB=planB.depositViaSupplemental-actualDepViaSupplementalB

  const adjustedReductionA=planA.reduction-rejectedReductionA
  const adjustedReductionB=planB.reduction-rejectedReductionB
  const adjustedSupplementalA=planA.supplemental-rejectedSupplementalA
  const adjustedSupplementalB=planB.supplemental-rejectedSupplementalB

  const cashCostA=integratedCurveCost(adjustedReductionA,t.reductionCurveA,t.step)
    +integratedCurveCost(adjustedSupplementalA,t.supplementalCurve,t.step)
  const cashCostB=integratedCurveCost(adjustedReductionB,t.reductionCurveB,t.step)
    +integratedCurveCost(adjustedSupplementalB,t.supplementalCurve,t.step)

  const endBankA=afterWithdrawA+actualSecurityDepositA
  const endBankB=afterWithdrawB+actualSecurityDepositB
  const endBankFed=afterWithdrawFed+accepted.Fed
  const totalStorage=endBankA+endBankB+endBankFed

  // Rejected A/B security deposits revert to current-year use. They are not spill.
  const directUseA=Math.max(0,Math.min(allocationA,c.demandA)-actualSecurityDepositA)
  const directUseB=Math.max(0,Math.min(allocationB,c.demandB)-actualSecurityDepositB)
  const spillUnbanked=federalAllocation-accepted.Fed

  const startStorage=start.A+start.B+start.Fed
  const accountedEnd=
    totalStorage+directUseA+directUseB+
    planA.bankWithdrawal+planB.bankWithdrawal+
    spillUnbanked
  const waterBalanceError=(startStorage+inflow)-accountedEnd

  return {
    year,inflow,
    allocationA,allocationB,federalAllocation,
    openingBankA:start.A,openingBankB:start.B,openingBankFed:start.Fed,
    bankWithdrawalA:planA.bankWithdrawal,bankWithdrawalB:planB.bankWithdrawal,
    supplementalA:adjustedSupplementalA,supplementalB:adjustedSupplementalB,
    reductionA:adjustedReductionA,reductionB:adjustedReductionB,
    securityDepositA:actualSecurityDepositA,securityDepositB:actualSecurityDepositB,
    depositViaReductionA:actualDepViaReductionA,depositViaReductionB:actualDepViaReductionB,
    depositViaSupplementalA:actualDepViaSupplementalA,depositViaSupplementalB:actualDepViaSupplementalB,
    depositFed:accepted.Fed,
    directUseA,directUseB,
    cashCostA,cashCostB,
    securityCostA:planA.securityCost,securityCostB:planB.securityCost,
    decisionCostA:cashCostA+planA.securityCost,
    decisionCostB:cashCostB+planB.securityCost,
    endBankA,endBankB,endBankFed,totalStorage,
    securityCoverageA:coverage(endBankA,t.securityCurveA.reliabilityStorage),
    securityCoverageB:coverage(endBankB,t.securityCurveB.reliabilityStorage),
    spillUnbanked,waterBalanceError
  }
}

export function integratedCurveCost(quantity:number,curve:MarginalCurve,step=0.01){
  let q=0
  let cost=0
  while(q+1e-9<quantity){
    const d=Math.min(step,quantity-q)
    cost+=d*marginalCurveCost(q,curve)
    q+=d
  }
  return cost
}
