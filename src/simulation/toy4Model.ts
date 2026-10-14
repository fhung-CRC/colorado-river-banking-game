import { allocateInflow, defaultConfig, seededRandom } from './model'
import type { Balances, SimulationConfig } from './types'

export type Toy4Player='A'|'B'
export type WildCardType='supplemental'|'flexibility'

export interface WildCard {
  id:string
  type:WildCardType
  quantity:number
  cost:number
  reward?:number
}

export interface SupplyEnhancementCard {
  id:string
  quantity:number
  cost:number
}

export interface Toy4TurnDraw {
  turn:number
  inflow:number
  allocationA:number
  allocationB:number
  federalAllocation:number
  demandA:number
  demandB:number
  hiddenUnitProfitA:number
  hiddenUnitProfitB:number
  wildCardA:WildCard|null
  wildCardB:WildCard|null
  systemRequirement:number
  supplyEnhancement:SupplyEnhancementCard|null
  enhancementLossRolls?:number[]
}

export interface Toy4Decision {
  saveFromAllocation:number
  bankWithdrawalLimit:number
  selectedWildCardIds:string[]
}

export interface Toy4PlayerResult {
  demand:number
  adjustedDemand:number
  allocation:number
  currentAllocationUsed:number
  requestedBankWithdrawal:number
  actualBankWithdrawal:number
  supplementalUsed:number
  flexibilityReduction:number
  servedDemand:number
  unservedDemand:number
  requestedDeposit:number
  acceptedDeposit:number
  wildCardCost:number
  shortagePenalty:number
  hiddenUnitProfit:number
}

export interface Toy4TurnResult {
  turn:number
  inflow:number
  playerA:Toy4PlayerResult
  playerB:Toy4PlayerResult
  depositFed:number
  federalAllocation:number
  fedRelease:number
  fedReleaseReward:number
  fedUnmetPenalty:number
  fedProtectionBonus:number
  supplyEnhancementAccepted:boolean
  supplyEnhancementQuantity:number
  supplyEnhancementReward:number
  naturalInflow:number
  endBalances:Balances
  totalStorage:number
  unbankedWater:number
  waterBalanceError:number
}

export interface Toy4Settlement {
  unitProfit:number
  servedDemand:number
  unservedDemand:number
  grossRevenue:number
  shortagePenalty:number
  wildCardCost:number
  netEarnings:number
}

const DEMANDS=[4,4.5,5,5.5,6]
const PROFITS_A=[2,2.5,3,3.5,4]
const PROFITS_B=[3,3.5,4,4.5,5]
const TOY4_HYDROLOGY=Array.from({length:25},(_,i)=>3+i*0.5)
const SYSTEM_REQUIREMENTS=[0,0,0,0,0.5,0.5,0.5,0.5,0.5,1,1,1,1,1,1,1.5,1.5,1.5,2,2]
const SUPPLY_ENHANCEMENT_QUANTITIES=[0.5,1,1.5]
const SUPPLY_ENHANCEMENT_COSTS=[5,10,15]

const SUPPLEMENTAL_VARIANTS=[
  {quantity:0.5,cost:1.5},
  {quantity:1.0,cost:2.5},
  {quantity:1.5,cost:4.0}
]
const FLEXIBILITY_VARIANTS=[
  {quantity:0.5,cost:0.5},
  {quantity:1.0,cost:1.0},
  {quantity:1.5,cost:2.0}
]

function pick<T>(items:T[],r:number){
  return items[Math.min(items.length-1,Math.floor(r*items.length))]
}

function drawSupplyEnhancement(rand:()=>number,turn:number):SupplyEnhancementCard{
  return {
    id:`fed-enhancement-t${turn}`,
    quantity:pick(SUPPLY_ENHANCEMENT_QUANTITIES,rand()),
    cost:pick(SUPPLY_ENHANCEMENT_COSTS,rand())
  }
}

function drawWildCard(rand:()=>number,turn:number,player:Toy4Player):WildCard|null{
  const drawChance=player==='B'?0.6:0.4
  if(rand()>=drawChance) return null
  const type:WildCardType=rand()<0.5?'supplemental':'flexibility'
  const variants=type==='supplemental'?SUPPLEMENTAL_VARIANTS:FLEXIBILITY_VARIANTS
  const v=pick(variants,rand())
  return {
    id:`t${turn}-${player}-${type}-${v.quantity}`,
    type,
    quantity:v.quantity,
    cost:v.cost
  }
}

export function createToy4Scenario(
  turns:number,
  seed:number,
  c:SimulationConfig=defaultConfig
):Toy4TurnDraw[]{
  const rand=seededRandom(seed)
  const n=Math.max(1,Math.min(50,Math.floor(turns)))
  const fedConfig={...c,excessAllocationMode:'fed' as const}
  const out:Toy4TurnDraw[]=[]
  for(let turn=1;turn<=n;turn++){
    const inflow=pick(TOY4_HYDROLOGY,rand())
    const a=allocateInflow(inflow,fedConfig)
    const systemRequirement=pick(SYSTEM_REQUIREMENTS,rand())
    out.push({
      turn,
      inflow,
      allocationA:a.allocationA,
      allocationB:a.allocationB,
      federalAllocation:a.federalAllocation,
      demandA:pick(DEMANDS,rand()),
      demandB:pick(DEMANDS,rand()),
      hiddenUnitProfitA:pick(PROFITS_A,rand()),
      hiddenUnitProfitB:pick(PROFITS_B,rand()),
      wildCardA:drawWildCard(rand,turn,'A'),
      wildCardB:drawWildCard(rand,turn,'B'),
      systemRequirement,
      supplyEnhancement:drawSupplyEnhancement(rand,turn),
      enhancementLossRolls:[rand(),rand(),rand()]
    })
  }
  return out
}

export function shortagePenalty(unserved:number){
  let q=Math.max(0,unserved)
  const moderate=Math.min(Math.max(0,q-0.5),1)
  const severe=Math.max(0,q-1.5)
  return moderate*1+severe*3
}

function selectedCards(hand:WildCard[],ids:string[]){
  const chosen=new Set(ids)
  return hand.filter(card=>chosen.has(card.id))
}

function cardEffects(cards:WildCard[]){
  let supplemental=0
  let flexibility=0
  let cost=0
  for(const card of cards){
    cost+=card.cost
    if(card.type==='supplemental') supplemental+=card.quantity
    else flexibility+=card.quantity
  }
  return {supplemental,flexibility,cost}
}

function halfMaf(v:number){
  return Math.round((Number.isFinite(v)?v:0)*2)/2
}

function clamp(v:number,min:number,max:number){
  return Math.min(max,Math.max(min,halfMaf(v)))
}

function prorateDeposits(requested:{A:number;B:number;Fed:number},space:number){
  const total=requested.A+requested.B+requested.Fed
  if(total<=space+1e-9) return requested
  if(total<=1e-9||space<=1e-9) return {A:0,B:0,Fed:0}
  const f=space/total
  return {A:requested.A*f,B:requested.B*f,Fed:requested.Fed*f}
}

export function resolveToy4Turn(
  start:Balances,
  draw:Toy4TurnDraw,
  decisionA:Toy4Decision,
  decisionB:Toy4Decision,
  handA:WildCard[],
  handB:WildCard[],
  serveSystemDemand:boolean=false,
  pendingEnhancementQuantity:number|boolean=0,
  c:SimulationConfig=defaultConfig
):Toy4TurnResult{
  // Supply Enhancement is purchased in the prior turn and affects this turn's
  // hydrology before the normal A -> B -> Fed allocation is applied.
  const supplyEnhancementQuantity=typeof pendingEnhancementQuantity==='boolean'\n    ?(pendingEnhancementQuantity?(draw.supplyEnhancement?.quantity??0):0)\n    :Math.max(0,pendingEnhancementQuantity)
  const supplyEnhancementAccepted=supplyEnhancementQuantity>0
  const supplyEnhancementReward=0
  const effectiveInflow=draw.inflow+supplyEnhancementQuantity
  const allocation=allocateInflow(effectiveInflow,{...c,excessAllocationMode:'fed'})
  const allocationA=allocation.allocationA
  const allocationB=allocation.allocationB
  const federalAllocation=allocation.federalAllocation
  const canServe=draw.systemRequirement<=start.Fed+1e-9
  const fedRelease=serveSystemDemand&&canServe?draw.systemRequirement:0
  const operatingStart:Balances={...start,Fed:start.Fed-fedRelease}

  const selectedA=selectedCards(handA,decisionA.selectedWildCardIds)
  const selectedB=selectedCards(handB,decisionB.selectedWildCardIds)
  const effectsA=cardEffects(selectedA)
  const effectsB=cardEffects(selectedB)

  // Demand Flexibility represents water-use efficiency: the player can produce
  // the same output with less water. It reduces water supply required, not the
  // economic demand/output used for the profit calculation.
  const adjustedDemandA=Math.max(0,draw.demandA-effectsA.flexibility)
  const adjustedDemandB=Math.max(0,draw.demandB-effectsB.flexibility)

  const saveA=clamp(decisionA.saveFromAllocation,0,allocationA)
  const saveB=clamp(decisionB.saveFromAllocation,0,allocationB)

  // A played supplemental card offsets current demand first. The supplemental
  // water itself cannot be banked, but by serving demand it can leave more of
  // the player's annual allocation unused; that unused allocation is then
  // banked automatically, subject to account and reservoir limits.
  const supplementalUsedA=Math.min(effectsA.supplemental,adjustedDemandA)
  const supplementalUsedB=Math.min(effectsB.supplemental,adjustedDemandB)
  const demandAfterSupplementalA=Math.max(0,adjustedDemandA-supplementalUsedA)
  const demandAfterSupplementalB=Math.max(0,adjustedDemandB-supplementalUsedB)

  const currentUseA=Math.min(demandAfterSupplementalA,Math.max(0,allocationA-saveA))
  const currentUseB=Math.min(demandAfterSupplementalB,Math.max(0,allocationB-saveB))

  const residualBeforeBankA=Math.max(0,demandAfterSupplementalA-currentUseA)
  const residualBeforeBankB=Math.max(0,demandAfterSupplementalB-currentUseB)
  const requestA=Math.min(residualBeforeBankA,operatingStart.A,Math.max(0,decisionA.bankWithdrawalLimit))
  const requestB=Math.min(residualBeforeBankB,operatingStart.B,Math.max(0,decisionB.bankWithdrawalLimit))

  // Independent accounts: A and B can withdraw only their own stored water.
  const allowed={A:requestA,B:requestB,Fed:0}
  const waterServedA=Math.min(adjustedDemandA,currentUseA+supplementalUsedA+allowed.A)
  const waterServedB=Math.min(adjustedDemandB,currentUseB+supplementalUsedB+allowed.B)
  const unservedWaterA=Math.max(0,adjustedDemandA-waterServedA)
  const unservedWaterB=Math.max(0,adjustedDemandB-waterServedB)

  // Each MAF of effective Demand Flexibility converts one MAF of avoided water
  // requirement into fully served economic demand. Therefore a 5 MAF demand
  // can earn profit on all 5 MAF with 4 MAF of supply plus 1 MAF of flexibility.
  const servedA=Math.min(draw.demandA,waterServedA+effectsA.flexibility)
  const servedB=Math.min(draw.demandB,waterServedB+effectsB.flexibility)
  const unservedA=Math.max(0,draw.demandA-servedA)
  const unservedB=Math.max(0,draw.demandB-servedB)

  const afterWithdrawA=operatingStart.A-allowed.A
  const afterWithdrawB=operatingStart.B-allowed.B
  const afterWithdrawFed=operatingStart.Fed
  const storageAfterWithdraw=afterWithdrawA+afterWithdrawB+afterWithdrawFed

  const requestedDepositA=Math.min(
    Math.max(0,allocationA-currentUseA),
    Math.max(0,c.bankLimitA-afterWithdrawA)
  )
  const requestedDepositB=Math.min(
    Math.max(0,allocationB-currentUseB),
    Math.max(0,c.bankLimitB-afterWithdrawB)
  )
  const requestedDepositFed=Math.min(
    Math.max(0,federalAllocation),
    Math.max(0,c.bankLimitFed-afterWithdrawFed)
  )
  const space=Math.max(0,c.reservoirCapacity-storageAfterWithdraw)
  const accepted=prorateDeposits(
    {A:requestedDepositA,B:requestedDepositB,Fed:requestedDepositFed},
    space
  )

  const endBalances:Balances={
    A:afterWithdrawA+accepted.A,
    B:afterWithdrawB+accepted.B,
    Fed:afterWithdrawFed+accepted.Fed
  }
  const totalStorage=endBalances.A+endBalances.B+endBalances.Fed
  const unbankedWater=
    Math.max(0,allocationA-currentUseA-accepted.A)+
    Math.max(0,allocationB-currentUseB-accepted.B)+
    Math.max(0,federalAllocation-accepted.Fed)

  const startStorage=start.A+start.B+start.Fed
  const accountedEnd=
    totalStorage+
    currentUseA+currentUseB+
    allowed.A+allowed.B+fedRelease+
    unbankedWater
  const waterBalanceError=(startStorage+effectiveInflow)-accountedEnd

  const fedReleaseReward=fedRelease>0||draw.systemRequirement===0?draw.systemRequirement*10:0
  const fedUnmetPenalty=fedRelease+1e-9>=draw.systemRequirement?0:draw.systemRequirement*15
  const fedProtectionBonus=totalStorage===0?-30:totalStorage>=4?15:totalStorage>=2?10:0

  return {
    turn:draw.turn,
    inflow:effectiveInflow,
    naturalInflow:draw.inflow,
    playerA:{
      demand:draw.demandA,
      adjustedDemand:adjustedDemandA,
      allocation:allocationA,
      currentAllocationUsed:currentUseA,
      requestedBankWithdrawal:requestA,
      actualBankWithdrawal:allowed.A,
      supplementalUsed:supplementalUsedA,
      flexibilityReduction:effectsA.flexibility,
      servedDemand:servedA,
      unservedDemand:unservedA,
      requestedDeposit:requestedDepositA,
      acceptedDeposit:accepted.A,
      wildCardCost:effectsA.cost,
      shortagePenalty:shortagePenalty(unservedA),
      hiddenUnitProfit:draw.hiddenUnitProfitA
    },
    playerB:{
      demand:draw.demandB,
      adjustedDemand:adjustedDemandB,
      allocation:allocationB,
      currentAllocationUsed:currentUseB,
      requestedBankWithdrawal:requestB,
      actualBankWithdrawal:allowed.B,
      supplementalUsed:supplementalUsedB,
      flexibilityReduction:effectsB.flexibility,
      servedDemand:servedB,
      unservedDemand:unservedB,
      requestedDeposit:requestedDepositB,
      acceptedDeposit:accepted.B,
      wildCardCost:effectsB.cost,
      shortagePenalty:shortagePenalty(unservedB),
      hiddenUnitProfit:draw.hiddenUnitProfitB
    },
    depositFed:accepted.Fed,
    federalAllocation:federalAllocation,
    fedRelease,
    fedReleaseReward,
    fedUnmetPenalty,
    fedProtectionBonus,
    supplyEnhancementAccepted,
    supplyEnhancementQuantity,
    supplyEnhancementReward,
    endBalances,
    totalStorage,
    unbankedWater,
    waterBalanceError
  }
}

export function settleToy4Player(result:Toy4PlayerResult):Toy4Settlement{
  const grossRevenue=result.servedDemand*result.hiddenUnitProfit
  const netEarnings=grossRevenue-result.shortagePenalty-result.wildCardCost
  return {
    unitProfit:result.hiddenUnitProfit,
    servedDemand:result.servedDemand,
    unservedDemand:result.unservedDemand,
    grossRevenue,
    shortagePenalty:result.shortagePenalty,
    wildCardCost:result.wildCardCost,
    netEarnings
  }
}

export function terminalSecurityValue(player:Toy4Player,bank:number){
  const rate=player==='A'?3:4
  return Math.max(0,bank)*rate
}

