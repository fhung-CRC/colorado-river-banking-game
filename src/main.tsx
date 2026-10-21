import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StandaloneToy4 from './StandaloneToy4'
import './styles.css'

const path=window.location.pathname.replace(/\/+$/,'')
const standalone=path.endsWith('/toy4')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{standalone?<StandaloneToy4/>:<App/>}</React.StrictMode>
)
