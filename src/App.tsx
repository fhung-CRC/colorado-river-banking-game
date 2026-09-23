import { useMemo, useState } from 'react'
import { autoDecision, defaultConfig, runYear, seededRandom } from './simulation/model'
import type { Balances, SimulationConfig, YearResult } from './simulation/types'

const fmt=(v:number)=>v.toFixed(2)

export default function App(){
  const [years,setYears]=useState(20)
  const [seed,setSeed]=useState(42)
  const [initialA,setInitialA]=useState(5)
  const [initialB,setInitialB]=useState(5)
  const [initialFed,setInitialFed]=useState(0)
  const [reductionCostA,setReductionCostA]=useState(defaultConfig.reductionCostA)
  const [reductionCostB,setReductionCostB]=useState(defaultConfig.reductionCostB)
  const [supplementalCost,setSupplementalCost]=useState(defaultConfig.supplementalCost)
  const [results,setResults]=useState<YearResult[]>([])
  const [message,setMessage]=useState('Set the assumptions and run Toy 1.')

  const config:SimulationConfig=useMemo(()=>({
    ...defaultConfig,
    reductionCostA:Math.max(0,reductionCostA),
    reductionCostB:Math.max(0,reductionCostB),
    supplementalCost:Math.max(0,supplementalCost)
  }),[reductionCostA,reductionCostB,supplementalCost])

  const endingBalances:Balances=results.length
    ? results[results.length-1].endBalances
    : {A:Math.min(config.bankLimitA,Math.max(0,initialA)),B:Math.min(config.bankLimitB,Math.max(0,initialB)),Fed:Math.min(config.bankLimitFed,Math.max(0,initialFed))}

  const totalStorage=endingBalances.A+endingBalances.B+endingBalances.Fed
  const withdrawable=Math.max(0,totalStorage-config.infrastructureFloor)

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
    const a=Math.min(config.bankLimitA,Math.max(0,initialA))
    const b=Math.min(config.bankLimitB,Math.max(0,initialB))
    const fed=Math.min(config.bankLimitFed,Math.max(0,initialFed))

    if(a+b+fed>config.reservoirCapacity){
      setMessage('Initial account balances cannot exceed the 20 MAF physical reservoir capacity.')
      return
    }

    const rand=seededRandom(seed)
    let balances:Balances={A:a,B:b,Fed:fed}
    const out:YearResult[]=[]
    const n=Math.min(100,Math.max(1,years))

    for(let y=1;y<=n;y++){
      const inflow=config.inflowMin+rand()*(config.inflowMax-config.inflowMin)
      const decision=autoDecision(balances,inflow,config)
      const result=runYear(y,balances,inflow,decision,config)
      balances=result.endBalances
      out.push(result)
    }

    setResults(out)
    setMessage('Simulation complete. All '+n+' years ran without interruption.')
  }

  const storagePct=Math.min(100,(totalStorage/config.reservoirCapacity)*100)
  const floorPct=(config.infrastructureFloor/config.reservoirCapacity)*100
  const aPct=(endingBalances.A/config.reservoirCapacity)*100
  const bPct=(endingBalances.B/config.reservoirCapacity)*100
  const fedPct=(endingBalances.Fed/config.reservoirCapacity)*100

  return <main className="app">
    <header>
      <div>
        <span className="eyebrow">Colorado River Banking Game</span>
        <h1>Toy 1: Seniority + Banking</h1>
        <p>A continuous multi-year simulation of seniority, banking, drought response, and economic costs.</p>
      </div>
    </header>

    <nav className="game-tabs" aria-label="Games">
      <button className="game-tab active" type="button" aria-current="page">Toy 1: Seniority + Banking</button>
      <span className="tab-note">Future games can be added here as additional tabs in this same repository.</span>
    </nav>

    <section className="setup panel">
      <div className="section-heading">
        <div><h2>Simulation setup</h2><p>Toy 1 runs the entire selected period automatically with no year-by-year interruption.</p></div>
        <button onClick={simulate}>Run simulation</button>
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
        <div className="section-heading">
          <div><h2>{results.length?'Ending reservoir':'Initial reservoir'}</h2><p>Physical capacity 20 MAF</p></div>
          <strong>{fmt(totalStorage)} MAF</strong>
        </div>

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
          <span><i className="dot a"></i>A {fmt(endingBalances.A)} / 10</span>
          <span><i className="dot b"></i>B {fmt(endingBalances.B)} / 10</span>
          <span><i className="dot so"></i>Fed {fmt(endingBalances.Fed)} / 5</span>
        </div>
        <div className="metric-row"><span>Withdrawable above floor</span><b>{fmt(withdrawable)} MAF</b></div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div><h2>Simulation summary</h2><p>Results summarize the full uninterrupted run.</p></div>
        </div>

        {summary ? <div className="summary">
          <div><span>Ending storage</span><b>{fmt(summary.endingStorage)} MAF</b></div>
          <div><span>Minimum storage</span><b>{fmt(summary.minimumStorage)} MAF</b></div>
          <div><span>A cumulative cost</span><b>{'$'+fmt(summary.costA)+'M'}</b></div>
          <div><span>B cumulative cost</span><b>{'$'+fmt(summary.costB)+'M'}</b></div>
          <div><span>Spill / unbanked</span><b>{fmt(summary.spill)} MAF</b></div>
          <div><span>Years simulated</span><b>{results.length}</b></div>
        </div> : <div className="empty-results">Run the simulation to populate the reservoir summary and annual ledger.</div>}

        <div className="strategy-note">
          <strong>Automatic strategy:</strong> each year, a player first uses current-year allocation, then requests previously banked water for any shortage. Any remaining shortage uses supplemental water when its input cost is below that player's reduction cost; otherwise the shortage is treated as demand reduction.
        </div>
      </div>
    </section>

    {results.length>0&&<section className="panel">
      <div className="section-heading"><div><h2>Annual results</h2><p>The simulation runs all years automatically; this table shows the year-by-year accounting after completion.</p></div></div>
      <div className="table-wrap">
        <table><thead><tr>
          <th>Yr</th><th>Inflow</th><th>A alloc.</th><th>B alloc.</th><th>Fed alloc.</th>
          <th>A wd</th><th>B wd</th><th>A supp.</th><th>B supp.</th><th>A reduce</th><th>B reduce</th>
          <th>A bank</th><th>B bank</th><th>Fed bank</th><th>Storage</th><th>Spill/unbanked</th><th>A cost ($M)</th><th>B cost ($M)</th><th>Balance err</th>
        </tr></thead><tbody>
          {results.map(r=><tr key={r.year}>
            <td>{r.year}</td><td>{fmt(r.inflow)}</td><td>{fmt(r.allocationA)}</td><td>{fmt(r.allocationB)}</td><td>{fmt(r.federalAllocation)}</td>
            <td>{fmt(r.actualWithdrawA)}</td><td>{fmt(r.actualWithdrawB)}</td>
            <td>{fmt(r.supplementalA)}</td><td>{fmt(r.supplementalB)}</td>
            <td>{fmt(r.reductionA)}</td><td>{fmt(r.reductionB)}</td>
            <td>{fmt(r.endBalances.A)}</td><td>{fmt(r.endBalances.B)}</td><td>{fmt(r.endBalances.Fed)}</td>
            <td>{fmt(r.totalStorage)}</td><td>{fmt(r.spill)}</td><td>{fmt(r.costA)}</td><td>{fmt(r.costB)}</td>
            <td className={Math.abs(r.waterBalanceError)<1e-9?'ok':'bad'}>{r.waterBalanceError.toExponential(1)}</td>
          </tr>)}
        </tbody></table>
      </div>
    </section>}

    <section className="rules">
      <strong>Toy 1 core rules:</strong> A receives the first 5 MAF of new inflow, B the next 5 MAF, and inflow above 10 MAF goes to the Fed account. Account limits are A=10, B=10, Fed=5 MAF; physical capacity is 20 MAF. Saved water remains with its account holder. Bank withdrawals cannot reduce storage below 5 MAF and are shared pro rata when requests exceed available withdrawable storage.
    </section>
  </main>
}
