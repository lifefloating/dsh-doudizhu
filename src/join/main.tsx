import { createRoot } from 'react-dom/client'
import { JoinApp } from './JoinApp.tsx'
import '../client/assets/join.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<JoinApp />)
