import { useMemo, useState } from 'react'
import { allocateInflow, autoDecision, defaultConfig, runYear, seededRandom } from './simulation/model'
import type { Balances, SimulationConfig, UserDecision, YearResult } from './simulation/types'

const fmt=(v:number)=>v.toFixed(2)

const blankDecision:UserDecision={
  conserveA:0,conserveB:0,
  requestWithdrawA:0,requestWithdrawB:0,
  requestSupplementalA:0,requestSupplementalB:0
}

interface ScenarioYear { inflow:number }

export default function App(){
  const [seed,setSeed]=useState(42)
  const [years,setYears]=useState(20)
  const [initialA,setInitialA]=useState(5)
  const [initialB,setInitialB]=useState(5)
  const [initialFed,setInitialFed]=useState(0)
  const [reductionCostA,setReductionCostA]=useState(defaultConfig.reductionCostA)
  const [reductionCostB,setReductionCostB]=useState(defaultConfig.reductionCostB)
  const [supplementalCost,setSupplementalCost]=useState(defaultConfig.supplementalCost)

  const [scenario,setScenario]=useState<ScenarioYear[]>([])
  const [yearIndex,setYearIndex]=useState(0)
  const [balances,setBalances]=useState<Balances>({A:5,B:5,Fed:0})
  const [decision,setDecision]=useState<UserDecision>(blankDecision)
  const [history,setHistory]=useState<YearResult[]>([])
  const [message,setMessage]=useState('Set initial balances and costs, then start a game.')

  const config:SimulationConfig=useMemo(()=>({
    ...defaultConfig,
    reductionCostA:Math.max(0,reductionCostA),
    reductionCostB:Math.max(0,reductionCostB),
    supplementalCost:Math.max(0,supplementalCost)
  }),[reductionCostA,reductionCostB,supplementalCost])

  const active=scenario[yearIndex]
  const allocation=active?allocateInflow(active.inflow,config):null
  const totalStorage=balances.A+balances.B+balances.Fed
  const withdrawable=Math.max(0,totalStorage-config.infrastructureFloor)

  const totals=useMemo(()=>({
    costA:history.reduce((s,r)=>s+r.costA,0),
    costB:history.reduce((s,r)=>s+r.costB,0),
    spill:history.reduce((s,r)=>s+r.spill,0)
  }),[history])

  function startGame(){
    const a=Math.min(config.bankLimitA,Math.max(0,initialA))
    const b=Math.min(config.bankLimitB,Math.max(0,initialB))
    const fed=Math.min(config.bankLimitFed,Math.max(0,initialFed))

    if(a+b+fed>config.reservoirCapacity){
      setMessage('Initial account balances cannot exceed the 20 MAF physical reservoir capacity.')
      return
    }

    const rand=seededRandom(seed)
    const n=Math.min(100,Math.max(1,years))
    const next=Array.from({length:n},()=>({
      inflow:config.inflowMin+rand()*(config.inflowMax-config.inflowMin)
    }))

    setScenario(next)
    setYearIndex(0)
    setBalances({A:a,B:b,Fed:fed})
    setDecision(blankDecision)
    setHistory([])
    setMessage('Year 1 is ready. Review the hydrology and make player decisions.')
  }

  function useEconomicStrategy(){
    if(!active) return
    setDecision(autoDecision(balances,active.inflow,config))
  }

  function endYear(){
    if(!active) return
    const result=runYear(yearIndex+1,balances,active.inflow,decision,config)
    setHistory([...history,result])
    setBalances(result.endBalances)
    setDecision(blankDecision)

    if(yearIndex+1>=scenario.length){
      setYearIndex(scenario.length)
      setMessage('Simulation complete. Review the annual ledger below.')
    }else{
      setYearIndex(yearIndex+1)
      setMessage('Year '+(yearIndex+2)+' is ready.')
    }
  }

  function setNumber(key:keyof UserDecision,value:string){
    const n=Number(value)
    setDecision(d=>({...d,[key]:Number.isFinite(n)?Math.max(0,n):0}))
  }

  const storagePct=Math.min(100,(totalStorage/config.reservoirCapacity)*100)
  const floorPct=(config.infrastructureFloor/config.reservoirCapacity)*100
  const aPct=(balances.A/config.reservoirCapacity)*100
  const bPct=(balances.B/config.reservoirCapacity)*100
  const fedPct=(balances.Fed/config.reservoirCapacity)*100

  return <main className="app">
    <header>
      <div>
        <span className="eyebrow">Interactive prototype</span>
        <h1>Colorado River Banking Game</h1>
        <p>Manage annual water use, savings, withdrawals, supplemental supply, and demand reductions under uncertain inflow.</p>
      </div>
    </header>

    <section className="setup panel">
      <div className="section-heading">
        <div><h2>Game setup</h2><p>Choose initial balances and the three economic cost assumptions.</p></div>
        <button onClick={startGame}>{scenario.length?'Restart game':'Start game'}</button>
      </div>

      <div className="setup-grid">
        <label>Years<input type="number" min="1" max="100" value={years} onChange={e=>setYears(+e.target.value)}/></label>
        <label>Random seed<input type="number" value={seed} onChange={e=>setSeed(+e.target.value)}/></label>
        <label>Initial A bank (MAF)<input type="number" step="0.1" min="0" max="10" value={initialA} onChange={e=>setInitialA(+e.target.value)}/></label>
        <label>Initial B bank (MAF)<input type="number" step="0.1" min="0" max="10" value={initialB} onChange={e=>setInitialB(+e.target.value)}/></label>
        <label>Initial Fed bank (MAF)<input type="number" step="0.1" min="0" max="5" value={initialFed} onChange={e=>setInitialFed(+e.target.value)}/></label>
        <label>A reduction cost ($/AF)<input type="number" min="0" step="1" value={reductionCostA} onChange={e=>setReductionCostA(Math.max(0,+e.target.value))}/></label>
        <label>B reduction cost ($/AF)<input type="number" min="0" step="1" value={reductionCostB} onChange={e=>setReductionCostB(Math.max(0,+e.target.value))}/></label>
        <label>Supplemental-water cost ($/AF)<input type="number" min="0" step="1" value={supplementalCost} onChange={e=>setSupplementalCost(Math.max(0,+e.target.value))}/></label>
      </div>

      <div className="status" aria-live="polite">{message}</div>
    </section>

    <section className="game-grid">
      <div className="panel reservoir-panel">
        <div className="section-heading"><div><h2>Reservoir</h2><p>Physical capacity 20 MAF</p></div><strong>{fmt(totalStorage)} MAF</strong></div>

        <div className="reservoir" aria-label={'Reservoir storage '+fmt(totalStorage)+' MAF out of 20 MAF'}>
          <div className="empty-label">Available space {fmt(20-totalStorage)} MAF</div>
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

        <div className="metric-row"><span>Currently withdrawable above floor</span><b>{fmt(withdrawable)} MAF</b></div>
      </div>

      <div className="panel year-panel">
        <div className="section-heading">
          <div><h2>{active?'Year '+(yearIndex+1):history.length?'Game complete':'Annual decision'}</h2><p>{active?'Make decisions before ending the year.':'Start a game to generate hydrology.'}</p></div>
          {active&&<button className="secondary" onClick={useEconomicStrategy}>Use economic strategy</button>}
        </div>

        {active&&allocation&&<>
          <div className="year-facts">
            <div><span>Inflow</span><b>{fmt(active.inflow)} MAF</b></div>
            <div><span>Supplemental cost</span><b>{'$'+fmt(config.supplementalCost)+'/AF'}</b></div>
            <div><span>A allocation</span><b>{fmt(allocation.allocationA)} MAF</b></div>
            <div><span>B allocation</span><b>{fmt(allocation.allocationB)} MAF</b></div>
            <div><span>Fed allocation</span><b>{fmt(allocation.federalAllocation)} MAF</b></div>
          </div>

          <div className="players">
            <PlayerCard
              name="Player A"
              note={'Senior right · reduction cost $'+fmt(config.reductionCostA)+'/AF'}
              allocation={allocation.allocationA}
              conserve={decision.conserveA}
              withdraw={decision.requestWithdrawA}
              supplemental={decision.requestSupplementalA}
              bank={balances.A}
              onConserve={v=>setNumber('conserveA',v)}
              onWithdraw={v=>setNumber('requestWithdrawA',v)}
              onSupplemental={v=>setNumber('requestSupplementalA',v)}
            />
            <PlayerCard
              name="Player B"
              note={'Junior right · reduction cost $'+fmt(config.reductionCostB)+'/AF'}
              allocation={allocation.allocationB}
              conserve={decision.conserveB}
              withdraw={decision.requestWithdrawB}
              supplemental={decision.requestSupplementalB}
              bank={balances.B}
              onConserve={v=>setNumber('conserveB',v)}
              onWithdraw={v=>setNumber('requestWithdrawB',v)}
              onSupplemental={v=>setNumber('requestSupplementalB',v)}
            />
          </div>

          <div className="decision-note">Any demand remaining after current allocation, actual bank withdrawal, and requested supplemental supply is treated as demand reduction. The economic-strategy button compares each player's reduction cost with the supplemental-water cost. If bank-withdrawal requests exceed water available above the 5 MAF floor, withdrawals are reduced pro rata.</div>
          <button className="end-year" onClick={endYear}>End year and apply decisions</button>
        </>}
      </div>
    </section>

    {history.length>0&&<section className="panel">
      <div className="section-heading"><div><h2>Game results</h2><p>Every completed year remains visible in the accounting ledger.</p></div></div>

      <div className="summary">
        <div><span>A cumulative cost</span><b>{'$'+fmt(totals.costA)+'M'}</b></div>
        <div><span>B cumulative cost</span><b>{'$'+fmt(totals.costB)+'M'}</b></div>
        <div><span>Cumulative spill/unbanked</span><b>{fmt(totals.spill)} MAF</b></div>
        <div><span>Years completed</span><b>{history.length}</b></div>
      </div>

      <div className="table-wrap">
        <table><thead><tr>
          <th>Yr</th><th>Inflow</th><th>A use</th><th>B use</th><th>A save</th><th>B save</th><th>Fed save</th>
          <th>A wd</th><th>B wd</th><th>A supp.</th><th>B supp.</th><th>A reduce</th><th>B reduce</th>
          <th>A bank</th><th>B bank</th><th>Fed bank</th><th>Storage</th><th>Spill/unbanked</th><th>Balance err</th>
        </tr></thead><tbody>
          {history.map(r=><tr key={r.year}>
            <td>{r.year}</td><td>{fmt(r.inflow)}</td><td>{fmt(r.directUseA)}</td><td>{fmt(r.directUseB)}</td>
            <td>{fmt(r.depositA)}</td><td>{fmt(r.depositB)}</td><td>{fmt(r.depositFed)}</td>
            <td>{fmt(r.actualWithdrawA)}</td><td>{fmt(r.actualWithdrawB)}</td>
            <td>{fmt(r.supplementalA)}</td><td>{fmt(r.supplementalB)}</td>
            <td>{fmt(r.reductionA)}</td><td>{fmt(r.reductionB)}</td>
            <td>{fmt(r.endBalances.A)}</td><td>{fmt(r.endBalances.B)}</td><td>{fmt(r.endBalances.Fed)}</td>
            <td>{fmt(r.totalStorage)}</td><td>{fmt(r.spill)}</td>
            <td className={Math.abs(r.waterBalanceError)<1e-9?'ok':'bad'}>{r.waterBalanceError.toExponential(1)}</td>
          </tr>)}
        </tbody></table>
      </div>

      <p className="note">Costs are shown in millions of dollars because $/AF values are multiplied by MAF quantities.</p>
    </section>}

    <section className="rules">
      <strong>Core rules:</strong> A receives the first 5 MAF of new inflow, B the next 5 MAF, and inflow above 10 MAF goes to the Fed account. Account limits are A=10, B=10, Fed=5 MAF; physical capacity is 20 MAF. Saved water remains with its account holder. Bank withdrawals cannot reduce storage below 5 MAF and are shared pro rata when requests exceed available withdrawable storage.
    </section>
  </main>
}

function PlayerCard(props:{
  name:string; note:string; allocation:number; conserve:number; withdraw:number; supplemental:number; bank:number;
  onConserve:(v:string)=>void; onWithdraw:(v:string)=>void; onSupplemental:(v:string)=>void;
}){
  return <article className="player-card">
    <div><h3>{props.name}</h3><p>{props.note}</p></div>
    <div className="player-facts"><span>Current allocation <b>{fmt(props.allocation)} MAF</b></span><span>Prior bank <b>{fmt(props.bank)} MAF</b></span></div>
    <label>Save from current allocation (MAF)<input type="number" min="0" max={props.allocation} step="0.1" value={props.conserve} onChange={e=>props.onConserve(e.target.value)}/></label>
    <label>Request bank withdrawal (MAF)<input type="number" min="0" max={props.bank} step="0.1" value={props.withdraw} onChange={e=>props.onWithdraw(e.target.value)}/></label>
    <label>Buy supplemental water (MAF)<input type="number" min="0" max="5" step="0.1" value={props.supplemental} onChange={e=>props.onSupplemental(e.target.value)}/></label>
  </article>
}
