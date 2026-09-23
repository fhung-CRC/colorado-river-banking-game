import type { Balances, SimulationConfig, UserDecision, YearResult } from './types'

export const defaultConfig: SimulationConfig = {
  reservoirCapacity:20, infrastructureFloor:5, inflowMin:2, inflowMax:15,
  annualRightA:5, annualRightB:5, bankLimitA:10, bankLimitB:10, bankLimitSO:5,
  reductionCostA:80, reductionCostB:40, supplementalMin:50, supplementalMax:100,
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
  return {allocationA,allocationB,systemAllocation:Math.max(0,inflow-allocationA-allocationB)}
}

function acceptDeposit(balance:number,requested:number,limit:number,space:number){
  return Math.max(0,Math.min(requested,limit-balance,space))
}

export function proRataWithdraw(balances:Balances,requests:{A:number;B:number},floor:number){
  const storage=balances.A+balances.B+balances.SO
  const available=Math.max(0,storage-floor)
  const a=Math.min(Math.max(0,requests.A),balances.A)
  const b=Math.min(Math.max(0,requests.B),balances.B)
  const total=a+b
  if(total<=available) return {A:a,B:b}
  if(total===0||available===0) return {A:0,B:0}
  const f=available/total
  return {A:a*f,B:b*f}
}

export function runYear(year:number,start:Balances,inflow:number,price:number,d:UserDecision,c:SimulationConfig=defaultConfig):YearResult{
  const startStorage=start.A+start.B+start.SO
  const {allocationA,allocationB,systemAllocation}=allocateInflow(inflow,c)

  const directUseA=Math.max(0,Math.min(c.demandA,allocationA-Math.max(0,d.conserveA)))
  const directUseB=Math.max(0,Math.min(c.demandB,allocationB-Math.max(0,d.conserveB)))
  const reqDepA=Math.max(0,allocationA-directUseA)
  const reqDepB=Math.max(0,allocationB-directUseB)

  const balances={...start}
  let space=Math.max(0,c.reservoirCapacity-startStorage)

  const depositA=acceptDeposit(balances.A,reqDepA,c.bankLimitA,space); balances.A+=depositA; space-=depositA
  const depositB=acceptDeposit(balances.B,reqDepB,c.bankLimitB,space); balances.B+=depositB; space-=depositB
  const depositSO=acceptDeposit(balances.SO,systemAllocation,c.bankLimitSO,space); balances.SO+=depositSO; space-=depositSO

  const spill=(reqDepA-depositA)+(reqDepB-depositB)+(systemAllocation-depositSO)

  const shortageA=Math.max(0,c.demandA-directUseA)
  const shortageB=Math.max(0,c.demandB-directUseB)
  const reqWA=Math.min(shortageA,Math.max(0,d.requestWithdrawA))
  const reqWB=Math.min(shortageB,Math.max(0,d.requestWithdrawB))
  const wd=proRataWithdraw(balances,{A:reqWA,B:reqWB},c.infrastructureFloor)
  balances.A-=wd.A; balances.B-=wd.B

  const residualA=Math.max(0,shortageA-wd.A)
  const residualB=Math.max(0,shortageB-wd.B)
  const supplementalA=price<c.reductionCostA?residualA:0
  const reductionA=residualA-supplementalA
  const supplementalB=price<c.reductionCostB?residualB:0
  const reductionB=residualB-supplementalB

  const totalStorage=balances.A+balances.B+balances.SO
  const costA=supplementalA*price+reductionA*c.reductionCostA
  const costB=supplementalB*price+reductionB*c.reductionCostB

  const accountedEnd=totalStorage+directUseA+directUseB+spill+wd.A+wd.B
  const waterBalanceError=(startStorage+inflow)-accountedEnd

  return {
    year,inflow,supplementalPrice:price,allocationA,allocationB,systemAllocation,
    depositA,depositB,depositSO,requestedWithdrawA:reqWA,requestedWithdrawB:reqWB,
    actualWithdrawA:wd.A,actualWithdrawB:wd.B,supplementalA,supplementalB,reductionA,reductionB,
    endBalances:balances,totalStorage,spill,costA,costB,waterBalanceError
  }
}

export function autoDecision(balances:Balances,inflow:number,c:SimulationConfig=defaultConfig):UserDecision{
  const {allocationA,allocationB}=allocateInflow(inflow,c)
  const shortageA=Math.max(0,c.demandA-allocationA)
  const shortageB=Math.max(0,c.demandB-allocationB)
  return {conserveA:0,conserveB:0,requestWithdrawA:Math.min(shortageA,balances.A),requestWithdrawB:Math.min(shortageB,balances.B)}
}
