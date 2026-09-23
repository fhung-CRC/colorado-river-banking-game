import { useMemo, useState } from 'react'
import { allocateInflow, autoDecision, defaultConfig, runYear, seededRandom } from './simulation/model'
import type { Balances, SimulationConfig, UserDecision, YearResult } from './simulation/types'

const fmt=(v:number)=>v.toFixed(2)

const blankDecision:UserDecision={
  conserveA:0,conserveB:0,
  requestWithdrawA:0,requestWithdrawB:0,
  requestSupplementalA:0,requestSupplementalB:0,
  fedRegulationRelease:0,fedEnvironmentalRelease:0
}

type GameTab='toy1'|'toy2'
interface ScenarioYear { inflow:number }

export default function App(){
  const [activeGame,setActiveGame]=useState<GameTab>('toy1')

  const [years,setYears]=useState(20)
  const [seed,setSeed]=useState(42)
  const [initialA,setInitialA]=useState(5)
  const [initialB,setInitialB]=useState(5)
  const [initialFed,setInitialFed]=useState(0)
  const [reductionCostA,setReductionCostA]=useState(defaultConfig.reductionCostA)
  const [reductionCostB,setReductionCostB]=useState(defaultConfig.reductionCostB)
  const [supplementalCost,setSupplementalCost]=useState(defaultConfig.supplementalCost)

  const config:SimulationConfig=useMemo(()=>({
    ...defaultConfig,
    reductionCostA:Math.max(0,reductionCostA),
    reductionCostB:Math.max(0,reductionCostB),
    supplementalCost:Math.max(0,supplementalCost)
  }),[reductionCostA,reductionCostB,supplementalCost])

  return <main className="app">
    <header>
      <div>
        <span className="eyebrow">Colorado River Banking Game</span>
        <h1>{activeGame==='toy1'?'Toy 1: Seniority + Banking':'Toy 2: Role-Play Simulation'}</h1>
        <p>{activeGame==='toy1'
          ?'A continuous multi-year simulation of seniority, banking, drought response, and economic costs.'
          :'A year-by-year role-play game where A, B, and the Fed make explicit water-management decisions.'}</p>
      </div>
    </header>

    <nav className="game-tabs" aria-label="Games">
      <button className={'game-tab '+(activeGame==='toy1'?'active':'')} type="button" onClick={()=>setActiveGame('toy1')} aria-current={activeGame==='toy1'?'page':undefined}>Toy 1: Seniority + Banking</button>
      <button className={'game-tab '+(activeGame==='toy2'?'active':'')} type="button" onClick={()=>setActiveGame('toy2')} aria-current={activeGame==='toy2'?'page':undefined}>Toy 2: Role-Play Simulation</button>
    </nav>

    {activeGame==='toy1'
      ? <Toy1 config={config} years={years} setYears={setYears} seed={seed} setSeed={setSeed}
          initialA={initialA} setInitialA={setInitialA} initialB={initialB} setInitialB={setInitialB}
          initialFed={initialFed} setInitialFed={setInitialFed}
          reductionCostA={reductionCostA} setReductionCostA={setReductionCostA}
          reductionCostB={reductionCostB} setReductionCostB={setReductionCostB}
          supplementalCost={supplementalCost} setSupplementalCost={setSupplementalCost}/>
      : <Toy2 config={config} years={years} setYears={setYears} seed={seed} setSeed={setSeed}
          initialA={initialA} setInitialA={setInitialA} initialB={initialB} setInitialB={setInitialB}
          initialFed={initialFed} setInitialFed={setInitialFed}
          reductionCostA={reductionCostA} setReductionCostA={setReductionCostA}
          reductionCostB={reductionCostB} setReductionCostB={setReductionCostB}
          supplementalCost={supplementalCost} setSupplementalCost={setSupplementalCost}/>}
  </main>
}

type SharedProps={
  config:SimulationConfig;
  years:number;setYears:(v:number)=>void;
  seed:number;setSeed:(v:number)=>void;
  initialA:number;setInitialA:(v:number)=>void;
  initialB:number;setInitialB:(v:number)=>void;
  initialFed:number;setInitialFed:(v:number)=>void;
  reductionCostA:number;setReductionCostA:(v:number)=>void;
  reductionCostB:number;setReductionCostB:(v:number)=>void;
  supplementalCost:number;setSupplementalCost:(v:number)=>void;
}

function SetupFields(p:SharedProps){
  return <div className="setup-grid">
    <label>Years<input type="number" min="1" max="100" value={p.years} onChange={e=>p.setYears(+e.target.value)}/></label>
    <label>Random seed<input type="number" value={p.seed} onChange={e=>p.setSeed(+e.target.value)}/></label>
    <label>Initial A bank (MAF)<input type="number" step="0.1" min="0" max="10" value={p.initialA} onChange={e=>p.setInitialA(+e.target.value)}/></label>
    <label>Initial B bank (MAF)<input type="number" step="0.1" min="0" max="10" value={p.initialB} onChange={e=>p.setInitialB(+e.target.value)}/></label>
    <label>Initial Fed bank (MAF)<input type="number" step="0.1" min="0" max="5" value={p.initialFed} onChange={e=>p.setInitialFed(+e.target.value)}/></label>
    <label>A reduction cost ($/AF)<input type="number" min="0" step="1" value={p.reductionCostA} onChange={e=>p.setReductionCostA(Math.max(0,+e.target.value))}/></label>
    <label>B reduction cost ($/AF)<input type="number" min="0" step="1" value={p.reductionCostB} onChange={e=>p.setReductionCostB(Math.max(0,+e.target.value))}/></label>
    <label>Supplemental-water cost ($/AF)<input type="number" min="0" step="1" value={p.supplementalCost} onChange={e=>p.setSupplementalCost(Math.max(0,+e.target.value))}/></label>
  </div>
}

function ReservoirFigure({balances,config,title}:{balances:Balances;config:SimulationConfig;title:string}){
  const total=balances.A+balances.B+balances.Fed
  const storagePct=Math.min(100,(total/config.reservoirCapacity)*100)
  const floorPct=(config.infrastructureFloor/config.reservoirCapacity)*100
  const aPct=(balances.A/config.reservoirCapacity)*100
  const bPct=(balances.B/config.reservoirCapacity)*100
  const fedPct=(balances.Fed/config.reservoirCapacity)*100
  return <div className="panel reservoir-panel">
    <div className="section-heading"><div><h2>{title}</h2><p>Physical capacity 20 MAF</p></div><strong>{fmt(total)} MAF</strong></div>
    <div className="reservoir" aria-label={'Reservoir storage '+fmt(total)+' MAF out of 20 MAF'}>
      <div className="empty-label">Available space {fmt(20-total)} MAF</div>
      <div className="stack" style={{height:storagePct+'%'}}>
        <div className="segment so" style={{height:(storagePct?fedPct/storagePct*100:0)+'%'}}></div>
        <div className="segment b" style={{height:(storagePct?bPct/storagePct*100:0)+'%'}}></div>
        <div className="segment a" style={{height:(storagePct?aPct/storagePct*100:0)+'%'}}></div>
      </div>
      <div className="floor-line" style={{bottom:floorPct+'%'}}><span>5 MAF infrastructure floor</span></div>
    </div>
    <div className="legend">
      <span><i className="dot a"></i>A {fmt(balances.A)} / 10</span>
      <span><i className="dot b"></i>B {fmt(balances.B)} / 10</span>
      <span><i className="dot so"></i>Fed {fmt(balances.Fed)} / 5</span>
    </div>
    <div className="metric-row"><span>Withdrawable above floor</span><b>{fmt(Math.max(0,total-config.infrastructureFloor))} MAF</b></div>
  </div>
}

function Toy1(p:SharedProps){
  const [results,setResults]=useState<YearResult[]>([])
  const [message,setMessage]=useState('Set the assumptions and run Toy 1.')

  const endingBalances:Balances=results.length
    ? results[results.length-1].endBalances
    : {A:Math.min(p.config.bankLimitA,Math.max(0,p.initialA)),B:Math.min(p.config.bankLimitB,Math.max(0,p.initialB)),Fed:Math.min(p.config.bankLimitFed,Math.max(0,p.initialFed))}

  const summary=useMemo(()=>{
    if(!results.length) return null
    return {
      endingStorage:results[results.length-1].totalStorage,
      minimumStorage:Math.min(...results.map(r=>r.totalStorage)),
      costA:results.reduce((s,r)=>s+r.costA,0),
      costB:results.reduce((s,r)=>s+r.costB,0),
      spill:results.reduce((s,r)=>s+r.spill,0)
    }
  },[results])

  function simulate(){
    const a=Math.min(p.config.bankLimitA,Math.max(0,p.initialA))
    const b=Math.min(p.config.bankLimitB,Math.max(0,p.initialB))
    const fed=Math.min(p.config.bankLimitFed,Math.max(0,p.initialFed))
    if(a+b+fed>p.config.reservoirCapacity){ setMessage('Initial account balances cannot exceed 20 MAF.'); return }

    const rand=seededRandom(p.seed)
    let balances:Balances={A:a,B:b,Fed:fed}
    const out:YearResult[]=[]
    const n=Math.min(100,Math.max(1,p.years))
    for(let y=1;y<=n;y++){
      const inflow=p.config.inflowMin+rand()*(p.config.inflowMax-p.config.inflowMin)
      const result=runYear(y,balances,inflow,autoDecision(balances,inflow,p.config),p.config)
      balances=result.endBalances
      out.push(result)
    }
    setResults(out)
    setMessage('Simulation complete. All '+n+' years ran without interruption.')
  }

  return <>
    <section className="setup panel">
      <div className="section-heading"><div><h2>Simulation setup</h2><p>Toy 1 runs the full period automatically.</p></div><button onClick={simulate}>Run simulation</button></div>
      <SetupFields {...p}/>
      <div className="status">{message}</div>
    </section>

    <section className="game-grid">
      <ReservoirFigure balances={endingBalances} config={p.config} title={results.length?'Ending reservoir':'Initial reservoir'}/>
      <div className="panel">
        <div className="section-heading"><div><h2>Simulation summary</h2><p>Results summarize the full uninterrupted run.</p></div></div>
        {summary?<div className="summary">
          <div><span>Ending storage</span><b>{fmt(summary.endingStorage)} MAF</b></div>
          <div><span>Minimum storage</span><b>{fmt(summary.minimumStorage)} MAF</b></div>
          <div><span>A cumulative cost</span><b>{'$'+fmt(summary.costA)+'M'}</b></div>
          <div><span>B cumulative cost</span><b>{'$'+fmt(summary.costB)+'M'}</b></div>
          <div><span>Spill / unbanked</span><b>{fmt(summary.spill)} MAF</b></div>
          <div><span>Years simulated</span><b>{results.length}</b></div>
        </div>:<div className="empty-results">Run the simulation to populate the reservoir summary and annual ledger.</div>}
        <div className="strategy-note"><strong>Automatic strategy:</strong> current allocation first, prior banked water second, then supplemental water when cheaper than demand reduction.</div>
      </div>
    </section>

    {results.length>0&&<ResultsTable results={results} showFedRelease={false}/>}
    <section className="rules"><strong>Toy 1 core rules:</strong> A receives the first 5 MAF of new inflow, B the next 5 MAF, and inflow above 10 MAF goes to the Fed account. Bank withdrawals cannot reduce storage below 5 MAF.</section>
  </>
}

function Toy2(p:SharedProps){
  const [scenario,setScenario]=useState<ScenarioYear[]>([])
  const [yearIndex,setYearIndex]=useState(0)
  const [balances,setBalances]=useState<Balances>({A:5,B:5,Fed:0})
  const [decision,setDecision]=useState<UserDecision>(blankDecision)
  const [history,setHistory]=useState<YearResult[]>([])
  const [message,setMessage]=useState('Start Toy 2 to begin the role-play simulation.')

  const active=scenario[yearIndex]
  const allocation=active?allocateInflow(active.inflow,p.config):null

  function startGame(){
    const a=Math.min(p.config.bankLimitA,Math.max(0,p.initialA))
    const b=Math.min(p.config.bankLimitB,Math.max(0,p.initialB))
    const fed=Math.min(p.config.bankLimitFed,Math.max(0,p.initialFed))
    if(a+b+fed>p.config.reservoirCapacity){ setMessage('Initial account balances cannot exceed 20 MAF.'); return }
    const rand=seededRandom(p.seed)
    const n=Math.min(100,Math.max(1,p.years))
    setScenario(Array.from({length:n},()=>({inflow:p.config.inflowMin+rand()*(p.config.inflowMax-p.config.inflowMin)})))
    setYearIndex(0); setBalances({A:a,B:b,Fed:fed}); setDecision(blankDecision); setHistory([])
    setMessage('Year 1 is ready. A, B, and the Fed can make decisions.')
  }

  function economicStrategy(){
    if(!active) return
    const d=autoDecision(balances,active.inflow,p.config)
    setDecision({...d,fedRegulationRelease:decision.fedRegulationRelease,fedEnvironmentalRelease:decision.fedEnvironmentalRelease})
  }

  function applyYear(){
    if(!active) return
    const result=runYear(yearIndex+1,balances,active.inflow,decision,p.config)
    setHistory([...history,result])
    setBalances(result.endBalances)
    setDecision(blankDecision)
    if(yearIndex+1>=scenario.length){
      setYearIndex(scenario.length)
      setMessage('Toy 2 complete. Review the role-play ledger.')
    }else{
      setYearIndex(yearIndex+1)
      setMessage('Year '+(yearIndex+2)+' is ready.')
    }
  }

  function setDecisionNumber(key:keyof UserDecision,value:string){
    const n=Number(value)
    setDecision(d=>({...d,[key]:Number.isFinite(n)?Math.max(0,n):0}))
  }

  return <>
    <section className="setup panel">
      <div className="section-heading"><div><h2>Role-play setup</h2><p>Toy 2 pauses each year so A, B, and the Fed can make decisions.</p></div><button onClick={startGame}>{scenario.length?'Restart game':'Start game'}</button></div>
      <SetupFields {...p}/>
      <div className="status">{message}</div>
    </section>

    <section className="game-grid">
      <ReservoirFigure balances={balances} config={p.config} title={active?'Opening reservoir for Year '+(yearIndex+1):history.length?'Ending reservoir':'Initial reservoir'}/>
      <div className="panel">
        <div className="section-heading">
          <div><h2>{active?'Year '+(yearIndex+1):history.length?'Game complete':'Annual decisions'}</h2><p>{active?'Choose A, B, and Fed actions before ending the year.':'Start Toy 2 to generate hydrology.'}</p></div>
          {active&&<button className="secondary" onClick={economicStrategy}>Auto A/B economics</button>}
        </div>

        {active&&allocation&&<>
          <div className="year-facts">
            <div><span>Inflow</span><b>{fmt(active.inflow)} MAF</b></div>
            <div><span>A allocation</span><b>{fmt(allocation.allocationA)} MAF</b></div>
            <div><span>B allocation</span><b>{fmt(allocation.allocationB)} MAF</b></div>
            <div><span>Fed allocation</span><b>{fmt(allocation.federalAllocation)} MAF</b></div>
            <div><span>Supplemental cost</span><b>{'$'+fmt(p.config.supplementalCost)+'/AF'}</b></div>
          </div>

          <div className="players">
            <PlayerCard name="Player A" note={'Senior right · reduction $'+fmt(p.config.reductionCostA)+'/AF'} allocation={allocation.allocationA} bank={balances.A}
              conserve={decision.conserveA} withdraw={decision.requestWithdrawA} supplemental={decision.requestSupplementalA}
              onConserve={v=>setDecisionNumber('conserveA',v)} onWithdraw={v=>setDecisionNumber('requestWithdrawA',v)} onSupplemental={v=>setDecisionNumber('requestSupplementalA',v)}/>
            <PlayerCard name="Player B" note={'Junior right · reduction $'+fmt(p.config.reductionCostB)+'/AF'} allocation={allocation.allocationB} bank={balances.B}
              conserve={decision.conserveB} withdraw={decision.requestWithdrawB} supplemental={decision.requestSupplementalB}
              onConserve={v=>setDecisionNumber('conserveB',v)} onWithdraw={v=>setDecisionNumber('requestWithdrawB',v)} onSupplemental={v=>setDecisionNumber('requestSupplementalB',v)}/>
          </div>

          <article className="fed-card">
            <div><h3>Fed</h3><p>Fed banked water can be released for system regulation or environmental benefits. These are stored-water releases and cannot push total reservoir storage below 5 MAF.</p></div>
            <div className="player-facts"><span>Fed bank <b>{fmt(balances.Fed)} MAF</b></span><span>New Fed allocation <b>{fmt(allocation.federalAllocation)} MAF</b></span></div>
            <div className="fed-inputs">
              <label>Regulation / system release (MAF)<input type="number" min="0" max={balances.Fed} step="0.1" value={decision.fedRegulationRelease} onChange={e=>setDecisionNumber('fedRegulationRelease',e.target.value)}/></label>
              <label>Environmental release (MAF)<input type="number" min="0" max={balances.Fed} step="0.1" value={decision.fedEnvironmentalRelease} onChange={e=>setDecisionNumber('fedEnvironmentalRelease',e.target.value)}/></label>
            </div>
          </article>

          <div className="decision-note">If A/B withdrawal requests plus Fed release requests exceed storage physically available above the 5 MAF floor, all eligible stored-water requests are reduced pro rata. New deposits in the current year do not create same-year withdrawal capacity.</div>
          <button className="end-year" onClick={applyYear}>End year and apply decisions</button>
        </>}
      </div>
    </section>

    {history.length>0&&<ResultsTable results={history} showFedRelease={true}/>}
    <section className="rules"><strong>Toy 2 core rules:</strong> Toy 1 banking and seniority rules still apply, but A and B make annual choices and the Fed may release its previously banked water for regulation/system management or environmental benefits.</section>
  </>
}

function PlayerCard(props:{
  name:string;note:string;allocation:number;bank:number;conserve:number;withdraw:number;supplemental:number;
  onConserve:(v:string)=>void;onWithdraw:(v:string)=>void;onSupplemental:(v:string)=>void;
}){
  return <article className="player-card">
    <div><h3>{props.name}</h3><p>{props.note}</p></div>
    <div className="player-facts"><span>Current allocation <b>{fmt(props.allocation)} MAF</b></span><span>Prior bank <b>{fmt(props.bank)} MAF</b></span></div>
    <label>Save from current allocation (MAF)<input type="number" min="0" max={props.allocation} step="0.1" value={props.conserve} onChange={e=>props.onConserve(e.target.value)}/></label>
    <label>Request bank withdrawal (MAF)<input type="number" min="0" max={props.bank} step="0.1" value={props.withdraw} onChange={e=>props.onWithdraw(e.target.value)}/></label>
    <label>Buy supplemental water (MAF)<input type="number" min="0" max="5" step="0.1" value={props.supplemental} onChange={e=>props.onSupplemental(e.target.value)}/></label>
  </article>
}

function ResultsTable({results,showFedRelease}:{results:YearResult[];showFedRelease:boolean}){
  return <section className="panel">
    <div className="section-heading"><div><h2>Annual results</h2><p>Completed-year accounting.</p></div></div>
    <div className="table-wrap"><table><thead><tr>
      <th>Yr</th><th>Inflow</th><th>A alloc.</th><th>B alloc.</th><th>Fed alloc.</th><th>A wd</th><th>B wd</th>
      {showFedRelease&&<><th>Fed regulation</th><th>Fed environment</th></>}
      <th>A supp.</th><th>B supp.</th><th>A reduce</th><th>B reduce</th><th>A bank</th><th>B bank</th><th>Fed bank</th><th>Storage</th><th>Spill/unbanked</th><th>A cost ($M)</th><th>B cost ($M)</th><th>Balance err</th>
    </tr></thead><tbody>
      {results.map(r=><tr key={r.year}>
        <td>{r.year}</td><td>{fmt(r.inflow)}</td><td>{fmt(r.allocationA)}</td><td>{fmt(r.allocationB)}</td><td>{fmt(r.federalAllocation)}</td>
        <td>{fmt(r.actualWithdrawA)}</td><td>{fmt(r.actualWithdrawB)}</td>
        {showFedRelease&&<><td>{fmt(r.actualFedRegulationRelease)}</td><td>{fmt(r.actualFedEnvironmentalRelease)}</td></>}
        <td>{fmt(r.supplementalA)}</td><td>{fmt(r.supplementalB)}</td><td>{fmt(r.reductionA)}</td><td>{fmt(r.reductionB)}</td>
        <td>{fmt(r.endBalances.A)}</td><td>{fmt(r.endBalances.B)}</td><td>{fmt(r.endBalances.Fed)}</td><td>{fmt(r.totalStorage)}</td><td>{fmt(r.spill)}</td>
        <td>{fmt(r.costA)}</td><td>{fmt(r.costB)}</td><td className={Math.abs(r.waterBalanceError)<1e-9?'ok':'bad'}>{r.waterBalanceError.toExponential(1)}</td>
      </tr>)}
    </tbody></table></div>
  </section>
}
