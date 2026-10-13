import { useState } from 'react'
import type { Balances, SimulationConfig } from './simulation/types'
import {
  addFedReleaseToTurn, createToy4Scenario, resolveToy4Turn, settleToy4Player, terminalSecurityValue
} from './simulation/toy4Model'
import type {
  Toy4Decision, Toy4Player, Toy4Settlement, Toy4TurnDraw, Toy4TurnResult, WildCard
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
  const [fedRelease,setFedRelease]=useState(0)
  const [pendingFedRelease,setPendingFedRelease]=useState(0)
  const [lastA,setLastA]=useState<Toy4Settlement|null>(null)
  const [lastB,setLastB]=useState<Toy4Settlement|null>(null)
  const [history,setHistory]=useState<Toy4TurnResult[]>([])
  const [message,setMessage]=useState('Start Toy 4 to deal the first turn.')
  const [finalScore,setFinalScore]=useState<{A:number;B:number}|null>(null)

  const active=scenario[turnIndex]
  const turnsRemaining=active?scenario.length-turnIndex:0
  const totalStorage=balances.A+balances.B+balances.Fed

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
    setFedRelease(0);setPendingFedRelease(0)
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
    const result=resolveToy4Turn(balances,active,decisionA,decisionB,handA,handB,fedRelease,p.config)
    const settlementA=settleToy4Player(result.playerA)
    const settlementB=settleToy4Player(result.playerB)
    const nextScoreA=scoreA+settlementA.netEarnings
    const nextScoreB=scoreB+settlementB.netEarnings
    const nextScoreFed=scoreFed+result.fedReleaseReward+result.fedProtectionBonus
    const usedA=new Set(decisionA.selectedWildCardIds)
    const usedB=new Set(decisionB.selectedWildCardIds)
    let nextHandA=handA.filter(c=>!usedA.has(c.id))
    let nextHandB=handB.filter(c=>!usedB.has(c.id))

    setHistory(h=>[...h,result])
    setBalances(result.endBalances)
    setLastA(settlementA);setLastB(settlementB)
    setScoreA(nextScoreA);setScoreB(nextScoreB);setScoreFed(nextScoreFed)
    setPendingFedRelease(result.fedRelease)

    if(turnIndex+1>=scenario.length){
      const finalA=nextScoreA+terminalSecurityValue('A',result.endBalances.A)
      const finalB=nextScoreB+terminalSecurityValue('B',result.endBalances.B)
      setFinalScore({A:finalA,B:finalB})
      setScenario([])
      setHandA(nextHandA);setHandB(nextHandB)
      setMessage('Game complete. Final-turn earnings and end-game security value have been added.')
      return
    }

    const baseNextTurn=scenario[turnIndex+1]
    const nextTurn=addFedReleaseToTurn(baseNextTurn,result.fedRelease,p.config)
    setScenario(prev=>prev.map((t,i)=>i===turnIndex+1?nextTurn:t))
    const a=addDrawToHand(nextHandA,nextTurn.wildCardA)
    const b=addDrawToHand(nextHandB,nextTurn.wildCardB)
    nextHandA=a.hand;nextHandB=b.hand
    setHandA(nextHandA);setHandB(nextHandB)
    setTurnIndex(i=>i+1)
    setDecisionA(blankDecision());setDecisionB(blankDecision());setFedRelease(0)
    setMessage('Turn '+(turnIndex+2)+' dealt. Last-turn unit profit is now revealed.'+a.note+b.note)
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
      </section>

      <section className="toy4-system-strip">
        <div><span>Turn</span><b>{active.turn} of {scenario.length}</b><small>{turnsRemaining-1} after this turn</small></div>
        <div><span>Hydrology this turn</span><b>{fmt(active.inflow)} MAF</b><small>Total annual water</small></div>
        <div><span>Reservoir storage</span><b>{fmt(totalStorage)} / {fmt(p.config.reservoirCapacity)} MAF</b><small>No fixed floor; Fed manages system protection</small></div>
        <div><span>Fed surplus card</span><b>{active.federalAllocation>0?fmt(active.federalAllocation)+' MAF':'None'}</b><small>Drawn only above 10 MAF</small></div>
        <div><span>Prior Fed release added</span><b>{fmt(pendingFedRelease)} MAF</b><small>Included in this turn's supply</small></div>
      </section>

      <section className="panel toy4-fed-control">
        <div><span className="eyebrow">Fed / System Operator</span><h3>Release water for next turn</h3><p>Fed earns $10/MAF released. It also earns a $10 protection bonus when ending reservoir storage is strictly greater than 2 MAF.</p></div>
        <label>Fed release (MAF)
          <input type="number" min="0" max={balances.Fed} step="0.5" value={Math.min(balances.Fed,fedRelease)}
            onChange={e=>setFedRelease(Math.min(balances.Fed,Math.max(0,+e.target.value||0)))}/>
        </label>
        <div className="toy4-fed-preview"><span>Release reward</span><b>{money(Math.min(balances.Fed,fedRelease)*10)}</b><small>Supply appears next turn</small></div>
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
      </div>
    </section>}

    <section className="rules"><strong>Toy 4 core rules:</strong> allocation and demand are newly dealt and resolved every turn. Any annual allocation left unused after demand is served is banked automatically, subject to account and reservoir limits. Supplemental cards can serve current demand and therefore free annual allocation for banking, but supplemental water itself cannot be banked. Demand Flexibility reduces the water required to produce the same goods and services without reducing profit-eligible demand. Banked water and unused wild cards persist, with up to six wild cards per player; B has a higher chance of drawing one each turn. Toy 4 has no fixed protection floor: Fed starts with 2 MAF, may release its banked water for $10/MAF with that water added to next turn's supply, and earns a $10 bonus whenever ending reservoir storage is strictly above 2 MAF. This turn's unit profit stays hidden until the next turn, and unserved demand earns no revenue and may incur an escalating shortage penalty.</section>
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
