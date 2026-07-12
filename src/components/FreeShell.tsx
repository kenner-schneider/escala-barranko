import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { clearFreeJwt, getFreeJwt } from '../lib/freeAuth'

export function FreeShell() {
  const navigate = useNavigate()
  if (!getFreeJwt()) return <Navigate to="/entrar" replace />

  return (
    <div className="free-shell">
      <main className="page free-page">
        <Outlet />
      </main>
      <nav className="bottomnav">
        <NavLink to="/disponibilidade">🗓️ Disponibilidade</NavLink>
        <NavLink to="/minha-escala">✅ Minha escala</NavLink>
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
