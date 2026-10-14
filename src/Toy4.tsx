import { useState } from 'react'
import type { Balances, SimulationConfig } from './simulation/types'
import {
  createToy4Scenario, resolveToy4Turn, settleToy4Player, terminalSecurityValue
} from './simulation/toy4Model'
import type {
  SupplyEnhancementCard, Toy4Decision, Toy4Player, Toy4Settlement, Toy4TurnDraw, Toy4TurnResult, WildCard
} from './simulation/toy4Model'

const fmt=(v:number)=>v.toFixed(2)
const money=(v:number)=>'$'+v.toFixed(2)

interface Toy4Props {
  config:SimulationConfig
  turns:number
  setTurns:(v:number)=>void
  seed:number
  setSeed:(v:number)=>void
}

const TOY4_START_BALANCES:Balances={A:1,B:2,Fed:2}

const blankDecision=():Toy4Decision=>({
  saveFromAllocation:0,
  bankWithdrawalLimit:10,
  selectedWildCardIds:[]
})

export default function Toy4(p:Toy4Props){
  const [scenario,setScenario]=useState<Toy4TurnDraw[]>([])
  const [turnIndex,setTurnIndex]=useState(0)
  const [balances,setBalances]=useState<Balances>(TOY4_START_BALANCES)
  const [handA,setHandA]=useState<WildCard[]>([])
  const [handB,setHandB]=useState<WildCard[]>([])
  const [decisionA,setDecisionA]=useState<Toy4Decision>(blankDecision())
  const [decisionB,setDecisionB]=useState<Toy4Decision>(blankDecision())
  const [scoreA,setScoreA]=useState(0)
  const [scoreB,setScoreB]=useState(0)
  const [scoreFed,setScoreFed]=useState(0)
  const [serveSystemDemand,setServeSystemDemand]=useState(false)
  const [heldEnhancements,setHeldEnhancements]=useState<SupplyEnhancementCard[]>([])
  const [enhancementAction,setEnhancementAction]=useState<{id:string;action:'invest'|'hold'}|null>(null)
  const [pendingEnhancement,setPendingEnhancement]=useState(0)
  const [lostEnhancements,setLostEnhancements]=useState<{card:SupplyEnhancementCard;reason:string}[]>([])
  const [lastA,setLastA]=useState<Toy4Settlement|null>(null)
  const [lastB,setLastB]=useState<Toy4Settlement|null>(null)
  const [history,setHistory]=useState<Toy4TurnResult[]>([])
  const [message,setMessage]=useState('Start Toy 4 to deal the first turn.')
  const [finalScore,setFinalScore]=useState<{A:number;B:number;Fed:number}|null>(null)

  const active=scenario[turnIndex]
  const turnsRemaining=active?scenario.length-turnIndex:0
  const totalStorage=balances.A+balances.B+balances.Fed
  const currentEnhancement=active?.supplyEnhancement??null
  const effectiveInflow=active?active.inflow+pendingEnhancement:0
  const effectiveAllocationA=Math.min(5,effectiveInflow)
  const effectiveAllocationB=Math.min(5,Math.max(0,effectiveInflow-5))
  const effectiveFedAllocation=Math.max(0,effectiveInflow-10)
  const activeForPlayers=active?{...active,allocationA:effectiveAllocationA,allocationB:effectiveAllocationB,federalAllocation:effectiveFedAllocation}:active

  function addDrawToHand(hand:WildCard[],card:WildCard|null){
    if(!card) return {hand,note:''}
    if(hand.length>=6) return {hand,note:' Wild-card hand was full, so the new card was discarded.'}
    return {hand:[...hand,card],note:''}
  }

  function startGame(){
    const next=createToy4Scenario(p.turns,p.seed,p.config)
    const a=addDrawToHand([],next[0]?.wildCardA??null)
    const b=addDrawToHand([],next[0]?.wildCardB??null)
    setScenario(next)
    setTurnIndex(0)
    setBalances(TOY4_START_BALANCES)
    setHandA(a.hand)
    setHandB(b.hand)
    setDecisionA(blankDecision())
    setDecisionB(blankDecision())
    setScoreA(0);setScoreB(0);setScoreFed(0)
    setServeSystemDemand(false);setHeldEnhancements([]);setEnhancementAction(null);setPendingEnhancement(0);setLostEnhancements([])
    setLastA(null);setLastB(null)
    setHistory([])
    setFinalScore(null)
    setMessage('Turn 1 dealt. Current unit profit is hidden until the start of the next turn.')
  }

  function toggleCard(player:Toy4Player,id:string){
    const setter=player==='A'?setDecisionA:setDecisionB
    setter(d=>({
      ...d,
      selectedWildCardIds:d.selectedWildCardIds.includes(id)
        ?d.selectedWildCardIds.filter(x=>x!==id)
        :[...d.selectedWildCardIds,id]
    }))
  }

  function endTurn(){
    if(!active) return
    const investCard=enhancementAction?.action==='invest'
      ?[currentEnhancement,...heldEnhancements].find(card=>card?.id===enhancementAction.id)??null
      :null
    const investmentCost=investCard?.cost??0
    const result=resolveToy4Turn(balances,active,decisionA,decisionB,handA,handB,serveSystemDemand,pendingEnhancement,p.config)
    const settlementA=settleToy4Player(result.playerA)
    const settlementB=settleToy4Player(result.playerB)
    const nextScoreA=scoreA+settlementA.netEarnings
    const nextScoreB=scoreB+settlementB.netEarnings
    const nextScoreFed=scoreFed+result.fedReleaseReward-result.fedUnmetPenalty+result.fedProtectionBonus-investmentCost
    const usedA=new Set(decisionA.selectedWildCardIds)
    const usedB=new Set(decisionB.selectedWildCardIds)
    let nextHandA=handA.filter(c=>!usedA.has(c.id))
    let nextHandB=handB.filter(c=>!usedB.has(c.id))
    let nextHeld=heldEnhancements.filter(card=>card.id!==investCard?.id)
    if(enhancementAction?.action==='hold'&&currentEnhancement&&nextHeld.length<3) nextHeld=[...nextHeld,currentEnhancement]

    setHistory(h=>[...h,result])
    setBalances(result.endBalances)
    setLastA(settlementA);setLastB(settlementB)
    setScoreA(nextScoreA);setScoreB(nextScoreB);setScoreFed(nextScoreFed)

    if(turnIndex+1>=scenario.length){
      const finalA=nextScoreA+terminalSecurityValue('A',result.endBalances.A)
      const finalB=nextScoreB+terminalSecurityValue('B',result.endBalances.B)
      setFinalScore({A:finalA,B:finalB,Fed:nextScoreFed})
      setScenario([])
      setHandA(nextHandA);setHandB(nextHandB);setHeldEnhancements(nextHeld)
      setMessage('Game complete. Final-turn earnings and end-game security value have been added.')
      return
    }

    const nextTurn=scenario[turnIndex+1]
    const lossReasons=['Scam Alert','Well Went Dry','Permit Denied','Funding Fell Through','Construction Failure','Partner Withdrew']
    const survived:SupplyEnhancementCard[]=[]
    const lost:{card:SupplyEnhancementCard;reason:string}[]=[]
    nextHeld.forEach((card,i)=>{
      const roll=nextTurn.enhancementLossRolls?.[i]??1
      if(roll<0.35) lost.push({card,reason:lossReasons[Math.floor(roll*1000)%lossReasons.length]})
      else survived.push(card)
    })
    const a=addDrawToHand(nextHandA,nextTurn.wildCardA)
    const b=addDrawToHand(nextHandB,nextTurn.wildCardB)
    nextHandA=a.hand;nextHandB=b.hand
    setHandA(nextHandA);setHandB(nextHandB);setHeldEnhancements(survived)
    if(lost.length) setLostEnhancements(old=>[...lost,...old].slice(0,3))
    setPendingEnhancement(investCard?.quantity??0)
    setTurnIndex(i=>i+1)
    setDecisionA(blankDecision());setDecisionB(blankDecision());setServeSystemDemand(false);setEnhancementAction(null)
    const lossNote=lost.length?' '+lost.map(x=>x.reason+': +'+fmt(x.card.quantity)+' MAF / '+money(x.card.cost??0)+' opportunity lost.').join(' '):''
    setMessage('Turn '+(turnIndex+2)+' dealt. Last-turn unit profit is now revealed.'+lossNote+a.note+b.note)
  }

  const finalBalances=history.length?history[history.length-1].endBalances:balances

  return <>
    <section className="panel toy4-setup">
      <div className="section-heading">
        <div>
          <h2>Turn-based card game setup</h2>
          <p>Each turn deals new hydrology, allocation, demand, and possible opportunity cards. Banked water and unused wild cards carry forward.</p>
        </div>
        <button onClick={startGame}>{active?'Restart game':'Start Toy 4'}</button>
      </div>
      <div className="setup-grid">
        <label>Turns<input type="number" min="2" max="30" value={p.turns} onChange={e=>p.setTurns(Math.max(2,Math.min(30,+e.target.value||10)))}/></label>
        <label>Random seed<input type="number" value={p.seed} onChange={e=>p.setSeed(+e.target.value)}/></label>
        <div className="toy4-fixed-rule"><span>Starting bank</span><b>A 1 / B 2 / Fed 2 MAF</b></div>
        <div className="toy4-fixed-rule"><span>End-game bank value</span><b>A $3 / B $4 per MAF</b></div>
      </div>
      <div className="status">{message}</div>
    </section>

    {active&&<>
      <section className="toy4-score-dock">
        <div><span>Player A</span><b>{money(scoreA)}</b><small>Bank {fmt(balances.A)} MAF</small></div>
        <div><span>Player B</span><b>{money(scoreB)}</b><small>Bank {fmt(balances.B)} MAF</small></div>
        <div><span>Fed / System Operator</span><b>{money(scoreFed)}</b><small>Bank {fmt(balances.Fed)} MAF</small></div>
        <div className="toy4-system-score"><span>System Storage</span><b>{fmt(totalStorage)} MAF</b><small>{fmt(totalStorage/p.config.reservoirCapacity*100)}% of capacity</small></div>
      </section>

      <ReservoirDashboard storage={totalStorage} capacity={p.config.reservoirCapacity} history={history}/>

      <section className="toy4-system-strip">
        <div><span>Turn</span><b>{active.turn} of {scenario.length}</b><small>{turnsRemaining-1} after this turn</small></div>
        <div><span>Natural hydrology</span><b>{fmt(active.inflow)} MAF</b><small>{acceptSupplyEnhancement&&active.supplyEnhancement?("Effective "+fmt(active.inflow+active.supplyEnhancement.quantity)+" MAF with enhancement"):"Before any supply enhancement"}</small></div>
        <div><span>Reservoir storage</span><b>{fmt(totalStorage)} / {fmt(p.config.reservoirCapacity)} MAF</b><small>No fixed floor; Fed manages system protection</small></div>
        <div><span>Fed surplus card</span><b>{active.federalAllocation>0?fmt(active.federalAllocation)+' MAF':'None'}</b><small>Drawn only above 10 MAF</small></div>
        
      </section>

      <section className="panel toy4-fed-control">
        <div className="toy4-player-top"><div><span className="eyebrow">Fed / System Operator</span><h2>Score {money(scoreFed)}</h2></div><div className="toy4-bank-chip">Bank <b>{fmt(balances.Fed)} MAF</b><small>System resilience account</small></div></div>
        <div className="toy4-cards fed-cards">
          <button type="button" disabled={active.systemRequirement===0||balances.Fed<active.systemRequirement} className={"toy4-card demand clickable "+(serveSystemDemand?"selected":"")} onClick={()=>setServeSystemDemand(v=>!v)}>
            <span>System Demand</span><b>{fmt(active.systemRequirement)} MAF</b>
            <small>{active.systemRequirement===0?"No demand this turn.":serveSystemDemand?"SELECTED · Serve full demand · Reward +"+money(active.systemRequirement*10):balances.Fed<active.systemRequirement?"Cannot fully serve · Penalty -"+money(active.systemRequirement*15):"CLICK TO SERVE · Ignore = penalty -"+money(active.systemRequirement*15)}</small>
          </button>
          {active.supplyEnhancement?<button type="button" className={"toy4-card allocation clickable "+(acceptSupplyEnhancement?"selected":"")} onClick={()=>setAcceptSupplyEnhancement(v=>!v)}>
            <span>Supply Enhancement Opportunity</span><b>+{fmt(active.supplyEnhancement.quantity)} MAF</b>
            <small>{acceptSupplyEnhancement?"SELECTED · Current-turn reward +"+money(active.supplyEnhancement.reward):"CLICK TO ACCEPT · Reward +"+money(active.supplyEnhancement.reward)+" · Expires this turn"}</small>
          </button>:<div className="toy4-no-card">No Supply Enhancement opportunity this turn</div>}
        </div>
        <div className="toy4-decision"><h3>Fed turn preview</h3><p>{serveSystemDemand?("System Demand served: +"+money(active.systemRequirement*10)+"."):("System Demand ignored: -"+money(active.systemRequirement*15)+".")} {acceptSupplyEnhancement&&active.supplyEnhancement?("Supply Enhancement: +"+money(active.supplyEnhancement.reward)+"."):""} Click a Fed card again to cancel that decision before ending the turn.</p></div>
      </section>

      <section className="toy4-board">
        <PlayerBoard
          player="A" score={scoreA} last={lastA} draw={active} bank={balances.A}
          hand={handA} decision={decisionA} setDecision={setDecisionA}
          toggleCard={id=>toggleCard('A',id)}
        />
        <PlayerBoard
          player="B" score={scoreB} last={lastB} draw={active} bank={balances.B}
          hand={handB} decision={decisionB} setDecision={setDecisionB}
          toggleCard={id=>toggleCard('B',id)}
        />
      </section>

      <button className="toy4-end-turn" onClick={endTurn}>Lock decisions and end turn</button>
    </>}

    {!active&&finalScore&&<section className="panel toy4-final">
      <div className="section-heading"><div><h2>Final score</h2><p>Cumulative net earnings plus end-game security value of remaining banked water.</p></div></div>
      <div className="toy4-final-grid">
        <div><span>Player A earnings before terminal value</span><b>{money(scoreA)}</b><small>Bank {fmt(finalBalances.A)} MAF × $3 = {money(terminalSecurityValue('A',finalBalances.A))}</small><strong>{money(finalScore.A)}</strong></div>
        <div><span>Player B earnings before terminal value</span><b>{money(scoreB)}</b><small>Bank {fmt(finalBalances.B)} MAF × $4 = {money(terminalSecurityValue('B',finalBalances.B))}</small><strong>{money(finalScore.B)}</strong></div>
        <div><span>Fed / System Operator final score</span><b>System performance</b><small>Demand rewards/penalties + enhancement rewards + storage protection</small><strong>{money(finalScore.Fed)}</strong></div>
        <div><span>Final reservoir storage</span><b>{fmt(finalBalances.A+finalBalances.B+finalBalances.Fed)} / {fmt(p.config.reservoirCapacity)} MAF</b><small>A {fmt(finalBalances.A)} · B {fmt(finalBalances.B)} · Fed {fmt(finalBalances.Fed)} MAF</small><strong>{fmt((finalBalances.A+finalBalances.B+finalBalances.Fed)/p.config.reservoirCapacity*100)}%</strong></div>
      </div>
    </section>}

    {!active&&finalScore&&<ReservoirDashboard storage={finalBalances.A+finalBalances.B+finalBalances.Fed} capacity={p.config.reservoirCapacity} history={history}/>}
    <section className="rules"><strong>Toy 4 core rules:</strong> allocation and demand are newly dealt and resolved every turn. Any annual allocation left unused after demand is served is banked automatically, subject to account and reservoir limits. Supplemental cards can serve current demand and therefore free annual allocation for banking, but supplemental water itself cannot be banked. Demand Flexibility reduces the water required to produce the same goods and services without reducing profit-eligible demand. Banked water and unused wild cards persist, with up to six wild cards per player; B has a higher chance of drawing one each turn. Toy 4 has no fixed protection floor. A, B, and Fed have independent accounts and can use only their own stored water. Fed starts with 2 MAF and receives a System Demand card each turn: the full demand is either served from the opening Fed bank or ignored for the penalty. Fed may also receive a one-turn Supply Enhancement opportunity; accepting it adds 0.5, 1.0, or 1.5 MAF to current-turn hydrology and earns the card's $5, $10, or $15 system-value reward. The opportunity expires after the turn. Fed also receives an ending-storage score of -$30 at zero storage, $0 below 2 MAF, $10 from 2 to under 4 MAF, and $30 at 4 MAF or more. This turn's unit profit stays hidden until the next turn, and unserved demand earns no revenue and may incur an escalating shortage penalty.</section>
  </>
}

function PlayerBoard(props:{
  player:Toy4Player
  score:number
  last:Toy4Settlement|null
  draw:Toy4TurnDraw
  bank:number
  hand:WildCard[]
  decision:Toy4Decision
  setDecision:(v:Toy4Decision|((d:Toy4Decision)=>Toy4Decision))=>void
  toggleCard:(id:string)=>void
}){
  const allocation=props.player==='A'?props.draw.allocationA:props.draw.allocationB
  const demand=props.player==='A'?props.draw.demandA:props.draw.demandB
  const terminalRate=props.player==='A'?3:4
  const selected=props.hand.filter(c=>props.decision.selectedWildCardIds.includes(c.id))
  const flexibility=selected.filter(c=>c.type==='flexibility').reduce((s,c)=>s+c.quantity,0)
  const supplemental=selected.filter(c=>c.type==='supplemental').reduce((s,c)=>s+c.quantity,0)
  const adjustedDemand=Math.max(0,demand-flexibility)
  const supplementalUsable=Math.min(supplemental,adjustedDemand)
  const demandAfterSupplemental=Math.max(0,adjustedDemand-supplementalUsable)
  const allocationAvailable=Math.max(0,allocation-props.decision.saveFromAllocation)
  const allocationUsed=Math.min(demandAfterSupplemental,allocationAvailable)
  const remaining=Math.max(0,demandAfterSupplemental-allocationUsed)
  const projectedBankWithdrawal=Math.min(remaining,props.bank,props.decision.bankWithdrawalLimit)
  const projectedEndingBank=Math.max(0,props.bank-projectedBankWithdrawal)+Math.max(0,allocation-allocationUsed)

  return <article className={'toy4-player player-'+props.player.toLowerCase()}>
    <div className="toy4-player-top">
      <div><span className="eyebrow">Player {props.player}</span><h2>Score {money(props.score)}</h2></div>
      <div className="toy4-bank-chip">Bank <b>{fmt(props.bank)} MAF</b><small>{'End value $'+terminalRate+'/MAF'}</small></div>
    </div>

    <div className="toy4-settlement">
      <span>Last turn settlement</span>
      {props.last?<div className="toy4-settlement-grid">
        <div><small>Unit profit</small><b>{money(props.last.unitProfit)}/MAF</b></div>
        <div><small>Served</small><b>{fmt(props.last.servedDemand)} MAF</b></div>
        <div><small>Gross</small><b>{money(props.last.grossRevenue)}</b></div>
        <div><small>Penalty + cards</small><b>-{money(props.last.shortagePenalty+props.last.wildCardCost)}</b></div>
        <div><small>Net earnings</small><b>{money(props.last.netEarnings)}</b></div>
      </div>:<p>No prior turn yet. Current unit profit is hidden.</p>}
    </div>

    <div className="toy4-cards">
      <GameCard kind="allocation" title="Allocation" value={fmt(allocation)+' MAF'} note="Unused allocation is banked automatically."/>
      <GameCard kind="demand" title="Demand" value={fmt(demand)+' MAF'} note="Must be resolved this turn."/>
      <GameCard kind="profit" title="Unit Profit" value={props.last?money(props.last.unitProfit)+'/MAF':'Hidden'} note={props.last?'Previous turn unit profit. Current turn remains unknown.':'No previous turn yet. Current turn remains unknown.'}/>
    </div>

    <div className="toy4-hand">
      <div className="toy4-hand-title"><strong>Persistent hand</strong><span>{props.hand.length}/6 wild cards</span></div>
      <div className="toy4-hand-cards">
        <GameCard kind="bank" title="Banked Water" value={fmt(props.bank)+' MAF'} note="Carries forward until withdrawn."/>
        {props.hand.map(card=><button
          key={card.id}
          className={'toy4-wild-card '+(props.decision.selectedWildCardIds.includes(card.id)?'selected':'')}
          onClick={()=>props.toggleCard(card.id)}
          type="button"
        >
          <span>{card.type==='supplemental'?'Supplemental Supply':'Demand Flexibility'}</span>
          <b>{card.type==='supplemental'?'+':'-'}{fmt(card.quantity)} MAF water needed</b>
          <small>Cost {money(card.cost)} · {props.decision.selectedWildCardIds.includes(card.id)?'PLAYING':'HOLD / PLAY'}</small>
        </button>)}
        {props.hand.length===0&&<div className="toy4-no-card">No wild cards held</div>}
      </div>
    </div>

    <div className="toy4-decision">
      <h3>This-turn decision</h3>
      <div className="toy4-decision-inputs">
        <label>Save from allocation (MAF)
          <input type="number" min="0" max={allocation} step="0.5" value={props.decision.saveFromAllocation}
            onChange={e=>props.setDecision(d=>({...d,saveFromAllocation:Math.min(allocation,Math.max(0,+e.target.value||0))}))}/>
        </label>
        <label>Maximum bank withdrawal (MAF)
          <input type="number" min="0" max={props.bank} step="0.5" value={Math.min(props.bank,props.decision.bankWithdrawalLimit)}
            onChange={e=>props.setDecision(d=>({...d,bankWithdrawalLimit:Math.min(props.bank,Math.max(0,+e.target.value||0))}))}/>
        </label>
      </div>
      <div className="toy4-projection">
        <div><span>Water supply needed</span><b>{fmt(adjustedDemand)} MAF</b></div>
        <div><span>Projected demand remaining</span><b>{fmt(Math.max(0,remaining-projectedBankWithdrawal))} MAF</b></div>
        <div><span>Projected bank after turn</span><b>{fmt(Math.min(10,projectedEndingBank))} MAF</b></div>
        <div><span>{props.last?'Previous unit profit':'Unit profit'}</span><b>{props.last?money(props.last.unitProfit)+'/MAF':'Hidden'}</b></div>
      </div>
      <p className="note">Demand Flexibility is water-use efficiency: it lowers the water needed to produce the same goods and services, so successfully served flexible demand still earns the full unit profit. Unserved demand earns no revenue. Additional shortage penalty: first 0.5 MAF free, next 1.0 MAF at $1/MAF, deeper shortage at $3/MAF.</p>
    </div>
  </article>
}

function GameCard({kind,title,value,note}:{kind:string;title:string;value:string;note:string}){
  return <div className={'toy4-card '+kind}>
    <span>{title}</span>
    <b>{value}</b>
    <small>{note}</small>
  </div>
}

function ReservoirDashboard({storage,capacity,history}:{storage:number;capacity:number;history:Toy4TurnResult[]}){
  const pct=Math.max(0,Math.min(100,capacity>0?storage/capacity*100:0))
  const points=[5,...history.map(h=>h.totalStorage)]
  const width=360,height=95,pad=8
  const poly=points.map((v,i)=>{const x=points.length===1?pad:pad+i*(width-pad*2)/(points.length-1);const y=height-pad-(Math.max(0,Math.min(capacity,v))/capacity)*(height-pad*2);return x+','+y}).join(' ')
  return <section className="panel toy4-reservoir-dashboard">
    <div className="toy4-reservoir-visual"><div className="toy4-reservoir-title"><span>System Reservoir</span><b>{fmt(storage)} / {fmt(capacity)} MAF</b></div><div className="toy4-reservoir-shell"><div className="toy4-reservoir-water" style={{height:pct+'%'}}></div><strong>{fmt(pct)}%</strong></div></div>
    <div className="toy4-storage-history"><span>Storage history</span><svg viewBox={'0 0 '+width+' '+height} role="img" aria-label="Reservoir storage history"><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad}/><polyline points={poly}/>{points.map((v,i)=>{const x=points.length===1?pad:pad+i*(width-pad*2)/(points.length-1);const y=height-pad-(Math.max(0,Math.min(capacity,v))/capacity)*(height-pad*2);return <circle key={i} cx={x} cy={y} r="3"/>})}</svg><small>Turn 0 through Turn {history.length} · Capacity {fmt(capacity)} MAF</small></div>
  </section>
}
