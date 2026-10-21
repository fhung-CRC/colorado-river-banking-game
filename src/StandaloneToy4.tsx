import { useMemo, useState } from 'react'
import Toy4 from './Toy4'
import { defaultConfig } from './simulation/model'
import type { SimulationConfig } from './simulation/types'

export default function StandaloneToy4(){
  const [turns,setTurns]=useState(10)
  const [seed,setSeed]=useState(42)
  const config:SimulationConfig=useMemo(()=>({...defaultConfig}),[])

  return <main className="app standalone-toy4">
    <header>
      <div>
        <span className="eyebrow">Colorado River Banking Game</span>
        <h1>Water Security Card Game</h1>
        <p>A turn-based game where hydrology, demand, hidden profit, banking, and wild cards shape each player’s water-security strategy.</p>
      </div>
    </header>
    <Toy4 config={config} turns={turns} setTurns={setTurns} seed={seed} setSeed={setSeed}/>
  </main>
}
