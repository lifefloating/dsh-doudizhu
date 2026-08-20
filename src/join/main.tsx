import { createRoot } from 'react-dom/client'
import { GateApp } from './GateApp.tsx'
import '../client/assets/join.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<GateApp />)
