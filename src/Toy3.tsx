import { useMemo, useState } from 'react'
import { seededRandom } from './simulation/model'
import {
  buildToy3Config, defaultPreferenceA, defaultPreferenceB,
  defaultReductionCurveA, defaultReductionCurveB, defaultSupplementalCurve,
  runRiskYear
} from './simulation/riskModel'
import type { Balances, ExcessAllocationMode, SimulationConfig } from './simulation/types'
import type { RiskYearResult, SecurityPreference, SecurityValueCurve } from './simulation/riskTypes'

const fmt=(v:number)=>v.toFixed(2)

export interface Toy3Props {
  config:SimulationConfig
  years:number
  setYears:(v:number)=>void
  seed:number
  setSeed:(v:number)=>void
  initialA:number
  setInitialA:(v:number)=>void
  initialB:number
  setInitialB:(v:number)=>void
  initialFed:number
  setInitialFed:(v:number)=>void
  excessAllocationMode:ExcessAllocationMode
  setExcessAllocationMode:(v:ExcessAllocationMode)=>void
}

export default function Toy3(p:Toy3Props){
  const [criticalA,setCriticalA]=useState(defaultPreferenceA.criticalShortage)
  const [criticalB,setCriticalB]=useState(defaultPreferenceB.criticalShortage)
  const [failureA,setFailureA]=useState(defaultPreferenceA.failureTolerance*100)
  const [failureB,setFailureB]=useState(defaultPreferenceB.failureTolerance*100)
  const [results,setResults]=useState<RiskYearResult[]>([])
  const [showSupplement,setShowSupplement]=useState(false)
  const [message,setMessage]=useState('Choose each player’s shortage-security level and risk tolerance, then run Toy 3.')

  const preferenceA:SecurityPreference=useMemo(()=>({
    criticalShortage:Math.max(0,criticalA),
    failureTolerance:Math.min(0.5,Math.max(0,failureA/100))
  }),[criticalA,failureA])
  const preferenceB:SecurityPreference=useMemo(()=>({
    criticalShortage:Math.max(0,criticalB),
    failureTolerance:Math.min(0.5,Math.max(0,failureB/100))
  }),[criticalB,failureB])

  const toy3=useMemo(()=>buildToy3Config(
    preferenceA,preferenceB,
    defaultReductionCurveA,defaultReductionCurveB,defaultSupplementalCurve,p.config
  ),[preferenceA,preferenceB,p.config])

  const endingBalances:Balances=results.length
    ? {A:results[results.length-1].endBankA,B:results[results.length-1].endBankB,Fed:results[results.length-1].endBankFed}
    : {
        A:Math.min(p.config.bankLimitA,Math.max(0,p.initialA)),
        B:Math.min(p.config.bankLimitB,Math.max(0,p.initialB)),
        Fed:Math.min(p.config.bankLimitFed,Math.max(0,p.initialFed))
      }

  const summary=useMemo(()=>{
    if(!results.length) return null
    return {
      cashA:results.reduce((s,r)=>s+r.cashCostA,0),
      cashB:results.reduce((s,r)=>s+r.cashCostB,0),
      securityA:results.reduce((s,r)=>s+r.securityCostA,0),
      securityB:results.reduce((s,r)=>s+r.securityCostB,0),
      decisionA:results.reduce((s,r)=>s+r.decisionCostA,0),
      decisionB:results.reduce((s,r)=>s+r.decisionCostB,0),
      endingStorage:results[results.length-1].totalStorage,
      minCoverageA:Math.min(...results.map(r=>r.securityCoverageA)),
      minCoverageB:Math.min(...results.map(r=>r.securityCoverageB))
    }
  },[results])

  function simulate(){
    const start:Balances={
      A:Math.min(p.config.bankLimitA,Math.max(0,p.initialA)),
      B:Math.min(p.config.bankLimitB,Math.max(0,p.initialB)),
      Fed:Math.min(p.config.bankLimitFed,Math.max(0,p.initialFed))
    }
    if(start.A+start.B+start.Fed>p.config.reservoirCapacity){
      setMessage('Initial account balances cannot exceed the 20 MAF physical reservoir capacity.')
      return
    }
    const rand=seededRandom(p.seed)
    let balances=start
    const out:RiskYearResult[]=[]
    const n=Math.min(100,Math.max(1,p.years))
    for(let y=1;y<=n;y++){
      const inflow=p.config.inflowMin+rand()*(p.config.inflowMax-p.config.inflowMin)
      const r=runRiskYear(y,balances,inflow,toy3,p.config)
      balances={A:r.endBankA,B:r.endBankB,Fed:r.endBankFed}
      out.push(r)
    }
    setResults(out)
    setMessage('Toy 3 complete. The fixed security-value curves were used as opportunity costs in the annual least-cost decisions.')
  }

  return <>
    <section className="setup panel">
      <div className="section-heading">
        <div>
          <h2>Risk + water-security setup</h2>
          <p>Players state the shortage they want to protect against and the chance of failure they are willing to accept. Toy 3 converts those preferences into fixed security-storage value curves, while excess inflow can be assigned either to the Fed/System Pool or pro rata to A and B.</p>
        </div>
        <button onClick={simulate}>Run Toy 3</button>
      </div>

      <div className="setup-grid toy3-basic">
        <label>Years<input type="number" min="1" max="100" value={p.years} onChange={e=>p.setYears(+e.target.value)}/></label>
        <label>Random seed<input type="number" value={p.seed} onChange={e=>p.setSeed(+e.target.value)}/></label>
        <label>Initial A bank (MAF)<input type="number" step="0.1" min="0" max="10" value={p.initialA} onChange={e=>p.setInitialA(+e.target.value)}/></label>
        <label>Initial B bank (MAF)<input type="number" step="0.1" min="0" max="10" value={p.initialB} onChange={e=>p.setInitialB(+e.target.value)}/></label>
        <label>A critical shortage (MAF)<input type="number" step="0.1" min="0" max="5" value={criticalA} onChange={e=>setCriticalA(+e.target.value)}/></label>
        <label>A acceptable failure chance (%)<input type="number" step="1" min="0" max="50" value={failureA} onChange={e=>setFailureA(+e.target.value)}/></label>
        <label>B critical shortage (MAF)<input type="number" step="0.1" min="0" max="5" value={criticalB} onChange={e=>setCriticalB(+e.target.value)}/></label>
        <label>B acceptable failure chance (%)<input type="number" step="1" min="0" max="50" value={failureB} onChange={e=>setFailureB(+e.target.value)}/></label>
        <label>Excess inflow allocation
          <select value={p.excessAllocationMode} onChange={e=>p.setExcessAllocationMode(e.target.value as ExcessAllocationMode)}>
            <option value="fed">Fed / System Pool</option>
            <option value="proRata">Pro Rata to A & B</option>
          </select>
        </label>
      </div>

      <div className="preference-summary">
        <div><span>Player A reliability statement</span><b>{'Keep reduction above '+fmt(preferenceA.criticalShortage)+' MAF to ≤ '+(preferenceA.failureTolerance*100).toFixed(0)+'% of stationary hydrologic outcomes'}</b></div>
        <div><span>Player B reliability statement</span><b>{'Keep reduction above '+fmt(preferenceB.criticalShortage)+' MAF to ≤ '+(preferenceB.failureTolerance*100).toFixed(0)+'% of stationary hydrologic outcomes'}</b></div>
      </div>
      <div className="status">{message}</div>
    </section>

    <section className="game-grid">
      <RiskReservoir
        balances={endingBalances}
        config={p.config}
        targetA={toy3.securityCurveA.reliabilityStorage}
        targetB={toy3.securityCurveB.reliabilityStorage}
      />
      <div className="panel">
        <div className="section-heading"><div><h2>Decision objective</h2><p>Toy 3 has no annual chance constraint. Reliability preferences are already embedded in the fixed security-value curve.</p></div></div>
        <div className="formula-card">
          <b>Minimize: reduction cost + supplemental-water cost + opportunity cost of withdrawing security storage</b>
        </div>
        <p className="note">The security term is a shadow/opportunity value, not a cash payment. Keeping the chance constraint out of the annual decision avoids counting the same security preference twice.</p>

        {summary?<div className="summary toy3-summary">
          <div><span>Ending storage</span><b>{fmt(summary.endingStorage)} MAF</b></div>
          <div><span>A realized cash cost</span><b>{'$'+fmt(summary.cashA)+'M'}</b></div>
          <div><span>B realized cash cost</span><b>{'$'+fmt(summary.cashB)+'M'}</b></div>
          <div><span>A security opportunity cost</span><b>{'$'+fmt(summary.securityA)+'M'}</b></div>
          <div><span>B security opportunity cost</span><b>{'$'+fmt(summary.securityB)+'M'}</b></div>
          <div><span>A decision objective</span><b>{'$'+fmt(summary.decisionA)+'M'}</b></div>
          <div><span>B decision objective</span><b>{'$'+fmt(summary.decisionB)+'M'}</b></div>
          <div><span>A minimum security coverage</span><b>{(summary.minCoverageA*100).toFixed(0)}%</b></div>
          <div><span>B minimum security coverage</span><b>{(summary.minCoverageB*100).toFixed(0)}%</b></div>
        </div>:<div className="empty-results">Run Toy 3 to see how the generated storage-value curves change shortage-response choices.</div>}
      </div>
    </section>

    <section className="panel">
      <div className="section-heading">
        <div><h2>Generated security-storage values</h2><p>These curves are calculated once from stationary hydrology and remain fixed throughout the game.</p></div>
        <button className="secondary" onClick={()=>setShowSupplement(v=>!v)}>{showSupplement?'Hide supplementary information':'View supplementary information'}</button>
      </div>
      <div className="security-output-grid">
        <SecurityCurveSummary name="Player A" curve={toy3.securityCurveA}/>
        <SecurityCurveSummary name="Player B" curve={toy3.securityCurveB}/>
      </div>
      {showSupplement&&<div className="supplement">
        <p><strong>How the curve is generated.</strong> For each possible opening storage level, the model uses equally weighted stationary inflow outcomes across the 2–15 MAF range, minimizes shortage-response cost, and then applies the player’s reliability requirement. When the unconstrained least-cost response violates the critical-shortage threshold too often, the cheapest hydrologic outcomes to protect are shifted toward supplemental supply until the allowed failure rate is met. The expected-cost reduction from an additional increment of storage becomes the marginal security-storage value.</p>
        <div className="supplement-grid">
          <CurveTable name="Player A" curve={toy3.securityCurveA}/>
          <CurveTable name="Player B" curve={toy3.securityCurveB}/>
        </div>
        <div className="assumption-box">
          <strong>Current simplification:</strong> the security-value curve is fixed under hydrologic stationarity, and Toy 3 uses the realized annual inflow directly. Forecast error is intentionally deferred to a future version.
        </div>
      </div>}
    </section>

    {results.length>0&&<RiskResults results={results}/>}

    <section className="rules"><strong>Toy 3 core rule:</strong> players specify reliability preferences once; Toy 3 translates them into a stationary marginal value of storage and uses that value in the annual cost-minimization objective. Excess inflow follows the selected Fed/System Pool or A/B pro-rata policy. The reliability chance constraint itself is reserved for the valuation step, not imposed again during gameplay.</section>
  </>
}

function SecurityCurveSummary({name,curve}:{name:string;curve:SecurityValueCurve}){
  const peak=Math.max(0,...curve.points.map(p=>p.marginalValue))
  return <div className="security-summary-card">
    <h3>{name}</h3>
    <div><span>Critical shortage</span><b>{fmt(curve.preference.criticalShortage)} MAF</b></div>
    <div><span>Failure tolerance</span><b>{(curve.preference.failureTolerance*100).toFixed(0)}%</b></div>
    <div><span>Storage where unconstrained policy meets reliability</span><b>{fmt(curve.reliabilityStorage)} MAF</b></div>
    <div><span>Peak generated marginal value</span><b>{'$'+peak.toFixed(0)+'/AF'}</b></div>
  </div>
}

function CurveTable({name,curve}:{name:string;curve:SecurityValueCurve}){
  const sampled=curve.points.filter((_,i)=>i%4===0 || i===curve.points.length-1)
  return <div className="curve-table-card">
    <h3>{name} valuation table</h3>
    <div className="table-wrap"><table className="small-table"><thead><tr>
      <th>Storage</th><th>Base failure</th><th>Constrained failure</th><th>Expected cost</th><th>Marginal value</th>
    </tr></thead><tbody>
      {sampled.map(p=><tr key={p.storage}>
        <td>{fmt(p.storage)}</td>
        <td>{(p.baseFailureProbability*100).toFixed(1)}%</td>
        <td>{(p.constrainedFailureProbability*100).toFixed(1)}%</td>
        <td>{'$'+fmt(p.expectedCost)+'M'}</td>
        <td>{'$'+p.marginalValue.toFixed(0)+'/AF'}</td>
      </tr>)}
    </tbody></table></div>
  </div>
}

function RiskReservoir({balances,config,targetA,targetB}:{balances:Balances;config:SimulationConfig;targetA:number;targetB:number}){
  const total=balances.A+balances.B+balances.Fed
  const pct=(v:number)=>Math.min(100,Math.max(0,v/config.reservoirCapacity*100))
  return <div className="panel reservoir-panel">
    <div className="section-heading"><div><h2>Reservoir + security position</h2><p>Physical capacity 20 MAF</p></div><strong>{fmt(total)} MAF</strong></div>
    <div className="reservoir">
      <div className="empty-label">Available space {fmt(config.reservoirCapacity-total)} MAF</div>
      <div className="stack" style={{height:pct(total)+'%'}}>
        <div className="segment so" style={{height:(total?balances.Fed/total*100:0)+'%'}}></div>
        <div className="segment b" style={{height:(total?balances.B/total*100:0)+'%'}}></div>
        <div className="segment a" style={{height:(total?balances.A/total*100:0)+'%'}}></div>
      </div>
      <div className="floor-line" style={{bottom:pct(config.infrastructureFloor)+'%'}}><span>5 MAF infrastructure floor</span></div>
    </div>
    <div className="legend">
      <span><i className="dot a"></i>A bank {fmt(balances.A)} MAF · reference security storage {fmt(targetA)}</span>
      <span><i className="dot b"></i>B bank {fmt(balances.B)} MAF · reference security storage {fmt(targetB)}</span>
      <span><i className="dot so"></i>Fed bank {fmt(balances.Fed)} MAF</span>
    </div>
  </div>
}

function RiskResults({results}:{results:RiskYearResult[]}){
  return <section className="panel">
    <div className="section-heading"><div><h2>Annual Toy 3 results</h2><p>The security opportunity cost affects decisions but is reported separately from realized cash cost.</p></div></div>
    <div className="table-wrap"><table className="toy3-table"><thead><tr>
      <th>Yr</th><th>Inflow</th><th>A alloc.</th><th>B alloc.</th>
      <th>A bank wd</th><th>B bank wd</th><th>A supp.</th><th>B supp.</th>
      <th>A reduce</th><th>B reduce</th><th>A surplus deposit</th><th>B surplus deposit</th><th>A security deposit</th><th>B security deposit</th>
      <th>A end bank</th><th>B end bank</th><th>A cash $M</th><th>B cash $M</th>
      <th>A security $M</th><th>B security $M</th><th>Storage</th><th>Balance err</th>
    </tr></thead><tbody>
      {results.map(r=><tr key={r.year}>
        <td>{r.year}</td><td>{fmt(r.inflow)}</td><td>{fmt(r.allocationA)}</td><td>{fmt(r.allocationB)}</td>
        <td>{fmt(r.bankWithdrawalA)}</td><td>{fmt(r.bankWithdrawalB)}</td><td>{fmt(r.supplementalA)}</td><td>{fmt(r.supplementalB)}</td>
        <td>{fmt(r.reductionA)}</td><td>{fmt(r.reductionB)}</td><td>{fmt(r.surplusDepositA)}</td><td>{fmt(r.surplusDepositB)}</td><td>{fmt(r.securityDepositA)}</td><td>{fmt(r.securityDepositB)}</td>
        <td>{fmt(r.endBankA)}</td><td>{fmt(r.endBankB)}</td><td>{fmt(r.cashCostA)}</td><td>{fmt(r.cashCostB)}</td>
        <td>{fmt(r.securityCostA)}</td><td>{fmt(r.securityCostB)}</td><td>{fmt(r.totalStorage)}</td>
        <td className={Math.abs(r.waterBalanceError)<1e-8?'ok':'bad'}>{r.waterBalanceError.toExponential(1)}</td>
      </tr>)}
    </tbody></table></div>
  </section>
}
