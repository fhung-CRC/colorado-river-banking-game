import { useMemo, useState } from 'react'
import { seededRandom } from './simulation/model'
import { defaultToy3Config, runRiskYear } from './simulation/riskModel'
import type { Balances, SimulationConfig } from './simulation/types'
import type { MarginalCurve, RiskYearResult, Toy3Config } from './simulation/riskTypes'

const fmt=(v:number)=>v.toFixed(2)
const costFmt=(v:number)=>'$'+v.toFixed(0)+'/AF'

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
}

export default function Toy3(p:Toy3Props){
  const [securityTargetA,setSecurityTargetA]=useState(defaultToy3Config.securityTargetA)
  const [securityTargetB,setSecurityTargetB]=useState(defaultToy3Config.securityTargetB)
  const [reductionA,setReductionA]=useState([...defaultToy3Config.reductionCurveA.costs])
  const [reductionB,setReductionB]=useState([...defaultToy3Config.reductionCurveB.costs])
  const [supplemental,setSupplemental]=useState([...defaultToy3Config.supplementalCurve.costs])
  const [securityA,setSecurityA]=useState([...defaultToy3Config.securityCostsA])
  const [securityB,setSecurityB]=useState([...defaultToy3Config.securityCostsB])
  const [results,setResults]=useState<RiskYearResult[]>([])
  const [message,setMessage]=useState('Set water-security targets and marginal cost curves, then run Toy 3.')

  const toy3:Toy3Config=useMemo(()=>({
    ...defaultToy3Config,
    securityTargetA:Math.max(0,Math.min(p.config.bankLimitA,securityTargetA)),
    securityTargetB:Math.max(0,Math.min(p.config.bankLimitB,securityTargetB)),
    reductionCurveA:{...defaultToy3Config.reductionCurveA,costs:reductionA.map(v=>Math.max(0,v))},
    reductionCurveB:{...defaultToy3Config.reductionCurveB,costs:reductionB.map(v=>Math.max(0,v))},
    supplementalCurve:{...defaultToy3Config.supplementalCurve,costs:supplemental.map(v=>Math.max(0,v))},
    securityCostsA:securityA.map(v=>Math.max(0,v)),
    securityCostsB:securityB.map(v=>Math.max(0,v))
  }),[p.config.bankLimitA,p.config.bankLimitB,securityTargetA,securityTargetB,reductionA,reductionB,supplemental,securityA,securityB])

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
      costA:results.reduce((s,r)=>s+r.cashCostA,0),
      costB:results.reduce((s,r)=>s+r.cashCostB,0),
      securityCostA:results.reduce((s,r)=>s+r.securityCostA,0),
      securityCostB:results.reduce((s,r)=>s+r.securityCostB,0),
      lowSecurityA:results.filter(r=>r.securityCoverageA<1-1e-9).length,
      lowSecurityB:results.filter(r=>r.securityCoverageB<1-1e-9).length,
      minCoverageA:Math.min(...results.map(r=>r.securityCoverageA)),
      minCoverageB:Math.min(...results.map(r=>r.securityCoverageB)),
      endingStorage:results[results.length-1].totalStorage
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
    const out:RiskYearResult[]=[]
    let balances=start
    const n=Math.min(100,Math.max(1,p.years))

    for(let y=1;y<=n;y++){
      const inflow=p.config.inflowMin+rand()*(p.config.inflowMax-p.config.inflowMin)
      const r=runRiskYear(y,balances,inflow,toy3,p.config)
      out.push(r)
      balances={A:r.endBankA,B:r.endBankB,Fed:r.endBankFed}
    }
    setResults(out)
    setMessage('Toy 3 complete. The model compared marginal reduction, supplemental-water, and lost-security costs in each year.')
  }

  return <>
    <section className="setup panel">
      <div className="section-heading">
        <div>
          <h2>Risk + water-security setup</h2>
          <p>Each player chooses a desired storage reserve. The model compares three marginal costs rather than following a fixed shortage-response hierarchy.</p>
        </div>
        <button onClick={simulate}>Run Toy 3</button>
      </div>

      <div className="setup-grid toy3-basic">
        <label>Years<input type="number" min="1" max="100" value={p.years} onChange={e=>p.setYears(+e.target.value)}/></label>
        <label>Random seed<input type="number" value={p.seed} onChange={e=>p.setSeed(+e.target.value)}/></label>
        <label>Initial A bank (MAF)<input type="number" step="0.1" min="0" max="10" value={p.initialA} onChange={e=>p.setInitialA(+e.target.value)}/></label>
        <label>Initial B bank (MAF)<input type="number" step="0.1" min="0" max="10" value={p.initialB} onChange={e=>p.setInitialB(+e.target.value)}/></label>
        <label>Initial Fed bank (MAF)<input type="number" step="0.1" min="0" max="5" value={p.initialFed} onChange={e=>p.setInitialFed(+e.target.value)}/></label>
        <label>A security target (MAF)<input type="number" step="0.1" min="0" max="10" value={securityTargetA} onChange={e=>setSecurityTargetA(+e.target.value)}/></label>
        <label>B security target (MAF)<input type="number" step="0.1" min="0" max="10" value={securityTargetB} onChange={e=>setSecurityTargetB(+e.target.value)}/></label>
      </div>
      <div className="status">{message}</div>
    </section>

    <section className="toy3-curves-grid">
      <CurveEditor title="Player A marginal reduction cost" curve={toy3.reductionCurveA} values={reductionA} onChange={setReductionA}/>
      <CurveEditor title="Player B marginal reduction cost" curve={toy3.reductionCurveB} values={reductionB} onChange={setReductionB}/>
      <CurveEditor title="Supplemental-water marginal cost" curve={toy3.supplementalCurve} values={supplemental} onChange={setSupplemental}/>
    </section>

    <section className="toy3-curves-grid security-grid">
      <SecurityEditor title="Player A marginal lost-security cost" values={securityA} onChange={setSecurityA}/>
      <SecurityEditor title="Player B marginal lost-security cost" values={securityB} onChange={setSecurityB}/>
      <div className="panel concept-card">
        <h2>How Toy 3 chooses</h2>
        <p>For each small increment of shortage, the model compares:</p>
        <div className="formula-card">
          <b>Reduction cost</b><span>vs.</span><b>Supplemental-water cost</b><span>vs.</span><b>Lost-security cost of bank withdrawal</b>
        </div>
        <p>The least-cost action can change as the curves cross. The security target is a preference, not a hard account floor.</p>
      </div>
    </section>

    <section className="game-grid">
      <RiskReservoir balances={endingBalances} config={p.config} targetA={toy3.securityTargetA} targetB={toy3.securityTargetB}/>
      <div className="panel">
        <div className="section-heading"><div><h2>Risk + security summary</h2><p>Cash costs and implicit security costs are shown separately.</p></div></div>
        {summary?<div className="summary toy3-summary">
          <div><span>Ending storage</span><b>{fmt(summary.endingStorage)} MAF</b></div>
          <div><span>A cash cost</span><b>{'$'+fmt(summary.costA)+'M'}</b></div>
          <div><span>B cash cost</span><b>{'$'+fmt(summary.costB)+'M'}</b></div>
          <div><span>A implicit security cost</span><b>{'$'+fmt(summary.securityCostA)+'M'}</b></div>
          <div><span>B implicit security cost</span><b>{'$'+fmt(summary.securityCostB)+'M'}</b></div>
          <div><span>A years below target</span><b>{summary.lowSecurityA}</b></div>
          <div><span>B years below target</span><b>{summary.lowSecurityB}</b></div>
          <div><span>A minimum coverage</span><b>{(summary.minCoverageA*100).toFixed(0)}%</b></div>
          <div><span>B minimum coverage</span><b>{(summary.minCoverageB*100).toFixed(0)}%</b></div>
        </div>:<div className="empty-results">Run Toy 3 to see how the competing marginal-cost curves affect storage and shortage responses.</div>}
        <div className="strategy-note"><strong>Important:</strong> “security cost” is an opportunity/risk value used to compare strategies. It is not a cash payment. Cash cost includes demand-reduction and supplemental-water costs.</div>
      </div>
    </section>

    {results.length>0&&<RiskResults results={results}/>}

    <section className="rules">
      <strong>Toy 3 core concept:</strong> Stored water has a future-security value. A player may choose reduction, supplemental supply, or bank withdrawal depending on which marginal cost is lowest at that point. When storage is below the selected security target, the model can also preserve current allocation in storage when the marginal value of rebuilding security exceeds the marginal cost of doing so.
    </section>
  </>
}

function CurveEditor({title,curve,values,onChange}:{title:string;curve:MarginalCurve;values:number[];onChange:(v:number[])=>void}){
  const labels=curve.breaks.map((b,i)=>i===0?'0-'+b:String(curve.breaks[i-1])+'-'+b)
  const max=Math.max(1,...values)
  const points=values.map((v,i)=>{
    const x=20+i*(240/Math.max(1,values.length-1))
    const y=125-(Math.max(0,v)/max)*95
    return x+','+y
  }).join(' ')

  function update(i:number,v:number){
    const next=[...values]
    next[i]=Number.isFinite(v)?Math.max(0,v):0
    onChange(next)
  }

  return <div className="panel curve-card">
    <h2>{title}</h2>
    <p>Piecewise marginal costs. Quantity bands are in MAF; values are $/AF.</p>
    <svg viewBox="0 0 280 145" className="curve-chart" role="img" aria-label={title}>
      <line x1="20" y1="125" x2="265" y2="125"/>
      <line x1="20" y1="15" x2="20" y2="125"/>
      <polyline points={points}/>
      {values.map((v,i)=>{
        const x=20+i*(240/Math.max(1,values.length-1))
        const y=125-(Math.max(0,v)/max)*95
        return <circle key={i} cx={x} cy={y} r="4"/>
      })}
      <text x="142" y="141" textAnchor="middle">Amount used</text>
      <text x="8" y="14">$ / AF</text>
    </svg>
    <div className="curve-inputs">
      {values.map((v,i)=><label key={i}><span>{labels[i]} MAF</span><input type="number" min="0" step="10" value={v} onChange={e=>update(i,+e.target.value)}/></label>)}
    </div>
  </div>
}

function SecurityEditor({title,values,onChange}:{title:string;values:number[];onChange:(v:number[])=>void}){
  const bands=['>=100%','75-100%','50-75%','25-50%','<25%']
  function update(i:number,v:number){
    const next=[...values]
    next[i]=Number.isFinite(v)?Math.max(0,v):0
    onChange(next)
  }
  return <div className="panel curve-card">
    <h2>{title}</h2>
    <p>Implicit marginal cost of giving up one more unit of stored-water security, by remaining coverage of the player's target.</p>
    <div className="security-steps">
      {values.map((v,i)=><div key={i} className="security-step"><span>{bands[i]}</span><b>{costFmt(v)}</b></div>)}
    </div>
    <div className="curve-inputs">
      {values.map((v,i)=><label key={i}><span>{bands[i]} coverage</span><input type="number" min="0" step="10" value={v} onChange={e=>update(i,+e.target.value)}/></label>)}
    </div>
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
      <span><i className="dot a"></i>A bank {fmt(balances.A)} MAF · target {fmt(targetA)} · coverage {targetA>0?(balances.A/targetA*100).toFixed(0)+'%':'n/a'}</span>
      <span><i className="dot b"></i>B bank {fmt(balances.B)} MAF · target {fmt(targetB)} · coverage {targetB>0?(balances.B/targetB*100).toFixed(0)+'%':'n/a'}</span>
      <span><i className="dot so"></i>Fed bank {fmt(balances.Fed)} MAF</span>
    </div>
  </div>
}

function RiskResults({results}:{results:RiskYearResult[]}){
  return <section className="panel">
    <div className="section-heading"><div><h2>Annual risk + security results</h2><p>Actions are the outcome of the competing marginal-cost curves.</p></div></div>
    <div className="table-wrap"><table className="toy3-table"><thead><tr>
      <th>Yr</th><th>Inflow</th><th>A alloc.</th><th>B alloc.</th>
      <th>A bank wd</th><th>B bank wd</th><th>A supp.</th><th>B supp.</th>
      <th>A reduce</th><th>B reduce</th><th>A security deposit</th><th>B security deposit</th>
      <th>A end bank</th><th>B end bank</th><th>A coverage</th><th>B coverage</th>
      <th>A cash $M</th><th>B cash $M</th><th>A security $M</th><th>B security $M</th>
      <th>Storage</th><th>Balance err</th>
    </tr></thead><tbody>
      {results.map(r=><tr key={r.year}>
        <td>{r.year}</td><td>{fmt(r.inflow)}</td><td>{fmt(r.allocationA)}</td><td>{fmt(r.allocationB)}</td>
        <td>{fmt(r.bankWithdrawalA)}</td><td>{fmt(r.bankWithdrawalB)}</td><td>{fmt(r.supplementalA)}</td><td>{fmt(r.supplementalB)}</td>
        <td>{fmt(r.reductionA)}</td><td>{fmt(r.reductionB)}</td><td>{fmt(r.securityDepositA)}</td><td>{fmt(r.securityDepositB)}</td>
        <td>{fmt(r.endBankA)}</td><td>{fmt(r.endBankB)}</td><td>{(r.securityCoverageA*100).toFixed(0)}%</td><td>{(r.securityCoverageB*100).toFixed(0)}%</td>
        <td>{fmt(r.cashCostA)}</td><td>{fmt(r.cashCostB)}</td><td>{fmt(r.securityCostA)}</td><td>{fmt(r.securityCostB)}</td>
        <td>{fmt(r.totalStorage)}</td><td className={Math.abs(r.waterBalanceError)<1e-8?'ok':'bad'}>{r.waterBalanceError.toExponential(1)}</td>
      </tr>)}
    </tbody></table></div>
  </section>
}
