import { useMemo, useState } from 'react'
import { autoDecision, defaultConfig, runYear, seededRandom } from './simulation/model'
import type { Balances, YearResult } from './simulation/types'

const fmt=(v:number)=>v.toFixed(2)

export default function App(){
  const [seed,setSeed]=useState(42)
  const [years,setYears]=useState(20)
  const [initialA,setInitialA]=useState(5)
  const [initialB,setInitialB]=useState(5)
  const [initialSO,setInitialSO]=useState(0)
  const [results,setResults]=useState<YearResult[]>([])

  const summary=useMemo(()=>{
    if(!results.length) return null
    return {
      storage:results.at(-1)!.totalStorage,
      minStorage:Math.min(...results.map(r=>r.totalStorage)),
      costA:results.reduce((s,r)=>s+r.costA,0),
      costB:results.reduce((s,r)=>s+r.costB,0)
    }
  },[results])

  function simulate(){
    const rand=seededRandom(seed)
    let balances:Balances={
      A:Math.min(10,Math.max(0,initialA)),
      B:Math.min(10,Math.max(0,initialB)),
      SO:Math.min(5,Math.max(0,initialSO))
    }
    const out:YearResult[]=[]
    const n=Math.min(100,Math.max(1,years))
    for(let y=1;y<=n;y++){
      const inflow=defaultConfig.inflowMin+rand()*(defaultConfig.inflowMax-defaultConfig.inflowMin)
      const price=defaultConfig.supplementalMin+rand()*(defaultConfig.supplementalMax-defaultConfig.supplementalMin)
      const result=runYear(y,balances,inflow,price,autoDecision(balances,inflow))
      balances=result.endBalances
      out.push(result)
    }
    setResults(out)
  }

  return <main className="app">
    <header><h1>Colorado River Banking Game</h1><p>V0.1 toy model with three storage accounts and a 5 MAF infrastructure floor.</p></header>
    <section className="controls">
      <label>Years<input type="number" min="1" max="100" value={years} onChange={e=>setYears(+e.target.value)}/></label>
      <label>Seed<input type="number" value={seed} onChange={e=>setSeed(+e.target.value)}/></label>
      <label>Initial A bank (MAF)<input type="number" step="0.1" min="0" max="10" value={initialA} onChange={e=>setInitialA(+e.target.value)}/></label>
      <label>Initial B bank (MAF)<input type="number" step="0.1" min="0" max="10" value={initialB} onChange={e=>setInitialB(+e.target.value)}/></label>
      <label>Initial system bank (MAF)<input type="number" step="0.1" min="0" max="5" value={initialSO} onChange={e=>setInitialSO(+e.target.value)}/></label>
      <button onClick={simulate}>Run simulation</button>
    </section>

    <section className="rules"><strong>V0.1 rules:</strong> A receives the first 5 MAF of annual inflow, B the next 5 MAF, and inflow above 10 MAF goes to the System Operator. Bank limits: A=10, B=10, SO=5 MAF. Reservoir capacity=20 MAF. Withdrawals cannot drive storage below 5 MAF; competing requests are fulfilled pro rata.</section>

    {summary&&<section className="summary">
      <div><span>Ending storage</span><b>{fmt(summary.storage)} MAF</b></div>
      <div><span>Minimum storage</span><b>{fmt(summary.minStorage)} MAF</b></div>
      <div><span>A cumulative cost</span><b>{'$'+fmt(summary.costA)+'M*'}</b></div>
      <div><span>B cumulative cost</span><b>{'$'+fmt(summary.costB)+'M*'}</b></div>
    </section>}

    {results.length>0&&<section className="table-wrap">
      <table><thead><tr>
        <th>Yr</th><th>Inflow</th><th>Price</th><th>A alloc</th><th>B alloc</th><th>SO alloc</th>
        <th>A bank</th><th>B bank</th><th>SO bank</th><th>A wd</th><th>B wd</th><th>Storage</th><th>Spill</th><th>Balance err</th>
      </tr></thead><tbody>
      {results.map(r=><tr key={r.year}>
        <td>{r.year}</td><td>{fmt(r.inflow)}</td><td>{'$'+fmt(r.supplementalPrice)}</td>
        <td>{fmt(r.allocationA)}</td><td>{fmt(r.allocationB)}</td><td>{fmt(r.systemAllocation)}</td>
        <td>{fmt(r.endBalances.A)}</td><td>{fmt(r.endBalances.B)}</td><td>{fmt(r.endBalances.SO)}</td>
        <td>{fmt(r.actualWithdrawA)}</td><td>{fmt(r.actualWithdrawB)}</td><td>{fmt(r.totalStorage)}</td>
        <td>{fmt(r.spill)}</td><td className={Math.abs(r.waterBalanceError)<1e-9?'ok':'bad'}>{r.waterBalanceError.toExponential(1)}</td>
      </tr>)}
      </tbody></table>
      <p className="note">*Dollar-per-acre-foot costs multiplied by MAF produce million-dollar totals.</p>
    </section>}
  </main>
}
