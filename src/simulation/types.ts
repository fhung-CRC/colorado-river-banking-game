export interface SimulationConfig {
  reservoirCapacity:number; infrastructureFloor:number; inflowMin:number; inflowMax:number;
  annualRightA:number; annualRightB:number; bankLimitA:number; bankLimitB:number; bankLimitFed:number;
  reductionCostA:number; reductionCostB:number; supplementalCost:number;
  demandA:number; demandB:number;
}
export interface Balances { A:number; B:number; Fed:number }
export interface UserDecision {
  conserveA:number; conserveB:number;
  requestWithdrawA:number; requestWithdrawB:number;
  requestSupplementalA:number; requestSupplementalB:number;
}
export interface YearResult {
  year:number; inflow:number; supplementalPrice:number;
  allocationA:number; allocationB:number; federalAllocation:number;
  directUseA:number; directUseB:number;
  depositA:number; depositB:number; depositFed:number;
  requestedWithdrawA:number; requestedWithdrawB:number;
  actualWithdrawA:number; actualWithdrawB:number;
  supplementalA:number; supplementalB:number;
  reductionA:number; reductionB:number;
  endBalances:Balances; totalStorage:number; spill:number;
  costA:number; costB:number; waterBalanceError:number;
}
