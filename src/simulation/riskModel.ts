import { allocateInflow, defaultConfig, proRataWithdraw } from './model'
import type { Balances, SimulationConfig } from './types'
import type { MarginalCurve, PlayerRiskPlan, RiskYearResult, Toy3Config } from './riskTypes'

export const defaultToy3Config:Toy3Config={
  step:0.1,
  securityTargetA:4,
  securityTargetB:3,
  reductionCurveA:{
    breaks:[0.5,1,2,3,5],
    costs:[30,60,120,250,600]
  },
  reductionCurveB:{
    breaks:[0.5,1,2,3,5],
    costs:[20,40,80,180,500]
  },
  supplementalCurve:{
    breaks:[0.5,1,1.5,2,5],
    costs:[60,90,140,220,800]
  },
  // Costs correspond to ending storage coverage bands:
  // >=100%, 75-100%, 50-75%, 25-50%, <25% of the security target.
  securityCostsA:[20,60,140,300,700],
  securityCostsB:[20,60,140,300,700]
}

export function marginalCurveCost(quantityUsed:number,curve:MarginalCurve){
  for(let i=0;i<curve.breaks.length;i++){
    if(quantityUsed<curve.breaks[i]-1e-9) return Math.max(0,curve.costs[i]??0)
  }
  return Math.max(0,curve.costs[curve.costs.length-1]??0)
}

export function securityMarginalCost(remainingBank:number,target:number,costs:number[]){
  if(target<=1e-9) return 0
  const coverage=Math.max(0,remainingBank)/target
  if(coverage>=1) return Math.max(0,costs[0]??0)
  if(coverage>=0.75) return Math.max(0,costs[1]??0)
  if(coverage>=0.5) return Math.max(0,costs[2]??0)
  if(coverage>=0.25) return Math.max(0,costs[3]??0)
  return Math.max(0,costs[4]??0)
}

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
  securityTarget:number,
  securityCosts:number[],
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
    const candidates=[
      {kind:'reduction' as const,cost:marginalCurveCost(reduction,reductionCurve)},
      {kind:'supplemental' as const,cost:marginalCurveCost(supplemental,supplementalCurve)}
    ]
    if(bankWithdrawal+q<=Math.min(openingBank,bankWithdrawalCap)+1e-9){
      candidates.push({
        kind:'bank' as const,
        cost:securityMarginalCost(openingBank-bankWithdrawal-q,securityTarget,securityCosts)
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
  securityTarget:number,
  accountLimit:number,
  physicalSpace:number,
  reductionCurve:MarginalCurve,
  supplementalCurve:MarginalCurve,
  securityCosts:number[],
  step:number
):PlayerRiskPlan{
  const plan={...base}
  let bank=bankAfterWithdrawal
  let remainingSpace=Math.max(0,physicalSpace)
  const target=Math.min(Math.max(0,securityTarget),accountLimit)

  while(bank+1e-9<target && bank+1e-9<accountLimit && remainingSpace>1e-9){
    const q=Math.min(step,target-bank,accountLimit-bank,remainingSpace)
    if(q<=1e-9) break

    const securityBenefit=securityMarginalCost(bank,securityTarget,securityCosts)
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

  // First pass: each player identifies the bank withdrawal it would prefer
  // if only its own account constrained access.
  const desiredA=optimizeShortage(
    shortageA,start.A,start.A,t.reductionCurveA,t.supplementalCurve,
    t.securityTargetA,t.securityCostsA,t.step
  )
  const desiredB=optimizeShortage(
    shortageB,start.B,start.B,t.reductionCurveB,t.supplementalCurve,
    t.securityTargetB,t.securityCostsB,t.step
  )

  // Shared reservoir liquidity above the infrastructure floor is still
  // allocated pro rata across eligible A/B bank-withdrawal requests.
  const allowed=proRataWithdraw(
    start,
    {A:desiredA.bankWithdrawal,B:desiredB.bankWithdrawal,Fed:0},
    c.infrastructureFloor
  )

  // Second pass: re-optimize with the physically available bank withdrawal cap.
  let planA=optimizeShortage(
    shortageA,start.A,allowed.A,t.reductionCurveA,t.supplementalCurve,
    t.securityTargetA,t.securityCostsA,t.step
  )
  let planB=optimizeShortage(
    shortageB,start.B,allowed.B,t.reductionCurveB,t.supplementalCurve,
    t.securityTargetB,t.securityCostsB,t.step
  )

  const afterWithdrawA=start.A-planA.bankWithdrawal
  const afterWithdrawB=start.B-planB.bankWithdrawal
  const afterWithdrawFed=start.Fed
  const storageAfterWithdraw=afterWithdrawA+afterWithdrawB+afterWithdrawFed

  // Security-building is only considered in years when the player receives
  // enough current allocation to meet normal demand before any voluntary saving.
  // Each account forms its desired security-building deposit independently.
  // Physical reservoir space is allocated later, pro rata across A, B, and Fed.
  if(allocationA>=c.demandA-1e-9){
    planA=addSecurityInvestment(
      planA,afterWithdrawA,t.securityTargetA,c.bankLimitA,c.reservoirCapacity,
      t.reductionCurveA,t.supplementalCurve,t.securityCostsA,t.step
    )
  }

  if(allocationB>=c.demandB-1e-9){
    planB=addSecurityInvestment(
      planB,afterWithdrawB,t.securityTargetB,c.bankLimitB,c.reservoirCapacity,
      t.reductionCurveB,t.supplementalCurve,t.securityCostsB,t.step
    )
  }

  // Requested deposits are capped by each account before competing for
  // remaining physical reservoir space.
  const reqDepA=Math.min(planA.securityDeposit,Math.max(0,c.bankLimitA-afterWithdrawA))
  const reqDepB=Math.min(planB.securityDeposit,Math.max(0,c.bankLimitB-afterWithdrawB))
  const reqDepFed=Math.min(federalAllocation,Math.max(0,c.bankLimitFed-afterWithdrawFed))
  const physicalSpace=Math.max(0,c.reservoirCapacity-storageAfterWithdraw)
  const accepted=prorateDeposits({A:reqDepA,B:reqDepB,Fed:reqDepFed},physicalSpace)

  // If physical storage competition trims a requested security deposit,
  // trim the corresponding current-year substitution action proportionally.
  const scaleA=reqDepA>1e-9?accepted.A/reqDepA:0
  const scaleB=reqDepB>1e-9?accepted.B/reqDepB:0

  const actualSecurityDepositA=accepted.A
  const actualSecurityDepositB=accepted.B
  const actualDepViaReductionA=planA.depositViaReduction*scaleA
  const actualDepViaReductionB=planB.depositViaReduction*scaleB
  const actualDepViaSupplementalA=planA.depositViaSupplemental*scaleA
  const actualDepViaSupplementalB=planB.depositViaSupplemental*scaleB

  // Remove costs associated with rejected security-building deposits.
  // Shortage-response actions are untouched.
  const rejectedReductionA=planA.depositViaReduction-actualDepViaReductionA
  const rejectedReductionB=planB.depositViaReduction-actualDepViaReductionB
  const rejectedSupplementalA=planA.depositViaSupplemental-actualDepViaSupplementalA
  const rejectedSupplementalB=planB.depositViaSupplemental-actualDepViaSupplementalB

  const adjustedReductionA=planA.reduction-rejectedReductionA
  const adjustedReductionB=planB.reduction-rejectedReductionB
  const adjustedSupplementalA=planA.supplemental-rejectedSupplementalA
  const adjustedSupplementalB=planB.supplemental-rejectedSupplementalB

  // Recompute cash costs exactly from the realized nonlinear quantities.
  const cashCostA=integratedCurveCost(adjustedReductionA,t.reductionCurveA,t.step)
    +integratedCurveCost(adjustedSupplementalA,t.supplementalCurve,t.step)
  const cashCostB=integratedCurveCost(adjustedReductionB,t.reductionCurveB,t.step)
    +integratedCurveCost(adjustedSupplementalB,t.supplementalCurve,t.step)

  const endBankA=afterWithdrawA+actualSecurityDepositA
  const endBankB=afterWithdrawB+actualSecurityDepositB
  const endBankFed=afterWithdrawFed+accepted.Fed
  const totalStorage=endBankA+endBankB+endBankFed

  const directUseA=Math.max(0,Math.min(allocationA,c.demandA)-actualSecurityDepositA)
  const directUseB=Math.max(0,Math.min(allocationB,c.demandB)-actualSecurityDepositB)

  const spillUnbanked=
    (reqDepA-accepted.A)+(reqDepB-accepted.B)+(federalAllocation-accepted.Fed)

  const startStorage=start.A+start.B+start.Fed
  const accountedEnd=
    totalStorage+directUseA+directUseB+
    planA.bankWithdrawal+planB.bankWithdrawal+
    spillUnbanked
  const waterBalanceError=(startStorage+inflow)-accountedEnd

  return {
    year,inflow,allocationA,allocationB,federalAllocation,
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
    securityCoverageA:coverage(endBankA,t.securityTargetA),
    securityCoverageB:coverage(endBankB,t.securityTargetB),
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
