import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Tema Stratum: localStorage → prefers-color-scheme → escuro (padrão)
const savedTheme = localStorage.getItem('escala.theme')
const initialTheme = savedTheme
  ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
document.documentElement.setAttribute('data-theme', initialTheme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
