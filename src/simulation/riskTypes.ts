export interface MarginalCurve {
  breaks:number[];
  costs:number[];
}

export interface Toy3Config {
  step:number;
  securityTargetA:number;
  securityTargetB:number;
  reductionCurveA:MarginalCurve;
  reductionCurveB:MarginalCurve;
  supplementalCurve:MarginalCurve;
  securityCostsA:number[];
  securityCostsB:number[];
}

export interface PlayerRiskPlan {
  bankWithdrawal:number;
  supplemental:number;
  reduction:number;
  securityDeposit:number;
  depositViaReduction:number;
  depositViaSupplemental:number;
  cashCost:number;
  securityCost:number;
  decisionCost:number;
}

export interface RiskYearResult {
  year:number;
  inflow:number;
  allocationA:number;
  allocationB:number;
  federalAllocation:number;
  openingBankA:number;
  openingBankB:number;
  openingBankFed:number;
  bankWithdrawalA:number;
  bankWithdrawalB:number;
  supplementalA:number;
  supplementalB:number;
  reductionA:number;
  reductionB:number;
  securityDepositA:number;
  securityDepositB:number;
  depositViaReductionA:number;
  depositViaReductionB:number;
  depositViaSupplementalA:number;
  depositViaSupplementalB:number;
  depositFed:number;
  directUseA:number;
  directUseB:number;
  cashCostA:number;
  cashCostB:number;
  securityCostA:number;
  securityCostB:number;
  decisionCostA:number;
  decisionCostB:number;
  endBankA:number;
  endBankB:number;
  endBankFed:number;
  totalStorage:number;
  securityCoverageA:number;
  securityCoverageB:number;
  spillUnbanked:number;
  waterBalanceError:number;
}
