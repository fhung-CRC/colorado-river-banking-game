export interface SimulationConfig {
  reservoirCapacity:number; infrastructureFloor:number; inflowMin:number; inflowMax:number;
  annualRightA:number; annualRightB:number; bankLimitA:number; bankLimitB:number; bankLimitSO:number;
  reductionCostA:number; reductionCostB:number; supplementalMin:number; supplementalMax:number;
  demandA:number; demandB:number;
}
export interface Balances { A:number; B:number; SO:number }
export interface UserDecision { conserveA:number; conserveB:number; requestWithdrawA:number; requestWithdrawB:number }
export interface YearResult {
  year:number; inflow:number; supplementalPrice:number; allocationA:number; allocationB:number; systemAllocation:number;
  depositA:number; depositB:number; depositSO:number; requestedWithdrawA:number; requestedWithdrawB:number;
  actualWithdrawA:number; actualWithdrawB:number; supplementalA:number; supplementalB:number;
  reductionA:number; reductionB:number; endBalances:Balances; totalStorage:number; spill:number;
  costA:number; costB:number; waterBalanceError:number;
}
