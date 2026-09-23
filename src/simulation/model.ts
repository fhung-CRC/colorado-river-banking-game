import type { Balances, SimulationConfig, UserDecision, YearResult } from './types'

export const defaultConfig: SimulationConfig = {
  reservoirCapacity:20, infrastructureFloor:5, inflowMin:2, inflowMax:15,
  annualRightA:5, annualRightB:5, bankLimitA:10, bankLimitB:10, bankLimitFed:5,
  reductionCostA:80, reductionCostB:40, supplementalCost:75,
  demandA:5, demandB:5
}

export function seededRandom(seed:number) {
  let s=seed>>>0
  return ()=>{ s=(1664525*s+1013904223)>>>0; return s/4294967296 }
}

export function allocateInflow(inflow:number,c:SimulationConfig=defaultConfig){
  const allocationA=Math.min(c.annualRightA,Math.max(0,inflow))
  const remaining=Math.max(0,inflow-allocationA)
  const allocationB=Math.min(c.annualRightB,remaining)
  return {allocationA,allocationB,federalAllocation:Math.max(0,inflow-allocationA-allocationB)}
}

function acceptDeposit(balance:number,requested:number,limit:number,space:number){
  return Math.max(0,Math.min(requested,limit-balance,space))
}

export function proRataWithdraw(
  balances:Balances,
  requests:{A:number;B:number;Fed?:number},
  floor:number
){
  const storage=balances.A+balances.B+balances.Fed
  const available=Math.max(0,storage-floor)
  const a=Math.min(Math.max(0,requests.A),balances.A)
  const b=Math.min(Math.max(0,requests.B),balances.B)
  const fed=Math.min(Math.max(0,requests.Fed??0),balances.Fed)
  const total=a+b+fed
  if(total<=available) return {A:a,B:b,Fed:fed}
  if(total===0||available===0) return {A:0,B:0,Fed:0}
  const f=available/total
  return {A:a*f,B:b*f,Fed:fed*f}
}

export function runYear(
  year:number,
  start:Balances,
  inflow:number,
  d:UserDecision,
  c:SimulationConfig=defaultConfig
):YearResult{
  const startStorage=start.A+start.B+start.Fed
  const {allocationA,allocationB,federalAllocation}=allocateInflow(inflow,c)

  const conserveA=Math.min(Math.max(0,d.conserveA),allocationA)
  const conserveB=Math.min(Math.max(0,d.conserveB),allocationB)
  const directUseA=Math.max(0,Math.min(c.demandA,allocationA-conserveA))
  const directUseB=Math.max(0,Math.min(c.demandB,allocationB-conserveB))
  const reqDepA=Math.max(0,allocationA-directUseA)
  const reqDepB=Math.max(0,allocationB-directUseB)

  const shortageA=Math.max(0,c.demandA-directUseA)
  const shortageB=Math.max(0,c.demandB-directUseB)

  const reqWA=Math.min(shortageA,Math.max(0,d.requestWithdrawA),start.A)
  const reqWB=Math.min(shortageB,Math.max(0,d.requestWithdrawB),start.B)

  const rawFedReg=Math.max(0,d.fedRegulationRelease)
  const rawFedEnv=Math.max(0,d.fedEnvironmentalRelease)
  const rawFedTotal=rawFedReg+rawFedEnv
  const eligibleFedTotal=Math.min(rawFedTotal,start.Fed)
  const eligibleFedReg=rawFedTotal>0?eligibleFedTotal*(rawFedReg/rawFedTotal):0
  const eligibleFedEnv=rawFedTotal>0?eligibleFedTotal*(rawFedEnv/rawFedTotal):0

  // Stored-water withdrawals and Fed releases use opening storage only.
  // Current-year deposits cannot create same-year withdrawal liquidity.
  const wd=proRataWithdraw(
    start,
    {A:reqWA,B:reqWB,Fed:eligibleFedTotal},
    c.infrastructureFloor
  )

  const fedScale=eligibleFedTotal>0?wd.Fed/eligibleFedTotal:0
  const actualFedReg=eligibleFedReg*fedScale
  const actualFedEnv=eligibleFedEnv*fedScale

  const balances:Balances={
    A:start.A-wd.A,
    B:start.B-wd.B,
    Fed:start.Fed-wd.Fed
  }

  let space=Math.max(0,c.reservoirCapacity-(balances.A+balances.B+balances.Fed))

  const depositA=acceptDeposit(balances.A,reqDepA,c.bankLimitA,space)
  balances.A+=depositA
  space-=depositA

  const depositB=acceptDeposit(balances.B,reqDepB,c.bankLimitB,space)
  balances.B+=depositB
  space-=depositB

  const depositFed=acceptDeposit(balances.Fed,federalAllocation,c.bankLimitFed,space)
  balances.Fed+=depositFed
  space-=depositFed

  const spill=(reqDepA-depositA)+(reqDepB-depositB)+(federalAllocation-depositFed)

  const residualA=Math.max(0,shortageA-wd.A)
  const residualB=Math.max(0,shortageB-wd.B)
  const supplementalA=Math.min(residualA,Math.max(0,d.requestSupplementalA))
  const supplementalB=Math.min(residualB,Math.max(0,d.requestSupplementalB))
  const reductionA=residualA-supplementalA
  const reductionB=residualB-supplementalB

  const totalStorage=balances.A+balances.B+balances.Fed
  const costA=supplementalA*c.supplementalCost+reductionA*c.reductionCostA
  const costB=supplementalB*c.supplementalCost+reductionB*c.reductionCostB
  const accountedEnd=totalStorage+directUseA+directUseB+spill+wd.A+wd.B+wd.Fed
  const waterBalanceError=(startStorage+inflow)-accountedEnd

  return {
    year,inflow,supplementalPrice:c.supplementalCost,
    allocationA,allocationB,federalAllocation,
    directUseA,directUseB,depositA,depositB,depositFed,
    requestedWithdrawA:reqWA,requestedWithdrawB:reqWB,
    actualWithdrawA:wd.A,actualWithdrawB:wd.B,
    requestedFedRegulationRelease:eligibleFedReg,
    requestedFedEnvironmentalRelease:eligibleFedEnv,
    actualFedRegulationRelease:actualFedReg,
    actualFedEnvironmentalRelease:actualFedEnv,
    supplementalA,supplementalB,reductionA,reductionB,
    endBalances:balances,totalStorage,spill,costA,costB,waterBalanceError
  }
}

export function autoDecision(
  balances:Balances,
  inflow:number,
  c:SimulationConfig=defaultConfig
):UserDecision{
  const {allocationA,allocationB}=allocateInflow(inflow,c)
  const shortageA=Math.max(0,c.demandA-allocationA)
  const shortageB=Math.max(0,c.demandB-allocationB)
  return {
    conserveA:0,conserveB:0,
    requestWithdrawA:Math.min(shortageA,balances.A),
    requestWithdrawB:Math.min(shortageB,balances.B),
    requestSupplementalA:c.supplementalCost<c.reductionCostA?shortageA:0,
    requestSupplementalB:c.supplementalCost<c.reductionCostB?shortageB:0,
    fedRegulationRelease:0,
    fedEnvironmentalRelease:0
  }
}
