import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { clearFreeJwt, getFreeJwt } from '../lib/freeAuth'
import { CalendarIcon, CalendarCheckIcon } from './icons'

export function FreeShell() {
  const navigate = useNavigate()
  if (!getFreeJwt()) return <Navigate to="/entrar" replace />

  return (
    <div className="free-shell">
      <main className="page free-page">
        <Outlet />
      </main>
      <nav className="bottomnav">
        <NavLink to="/disponibilidade"><CalendarIcon size={17} /> Disponibilidade</NavLink>
        <NavLink to="/minha-escala"><CalendarCheckIcon size={17} /> Minha escala</NavLink>
        <button
          className="btn-link"
          onClick={() => { clearFreeJwt(); navigate('/entrar') }}
        >
          Sair
        </button>
      </nav>
    </div>
  )
}
