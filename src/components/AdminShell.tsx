import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Profile, Restaurant } from '../lib/types'
import { Loading } from './ui'

export interface AdminCtxValue {
  profile: Profile
  restaurant: Restaurant
  reloadRestaurant: () => Promise<void>
}

const AdminCtx = createContext<AdminCtxValue | null>(null)
export const useAdmin = () => useContext(AdminCtx)!

type State = 'loading' | 'anon' | 'noprofile' | 'root' | 'ready'

export function AdminShell() {
  const [state, setState] = useState<State>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return setState('anon')
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    if (!prof) return setState('noprofile')
    if (prof.role === 'root') return setState('root')
    const { data: rest } = await supabase.from('restaurants').select('*').eq('id', prof.restaurant_id).single()
    setProfile(prof)
    setRestaurant(rest)
    setState('ready')
  }, [])

  useEffect(() => {
    load()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState('anon')
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  if (state === 'loading') return <Loading />
  if (state === 'anon') return <Navigate to="/login" replace />
  if (state === 'root') return <Navigate to="/root" replace />
  if (state === 'noprofile') {
    return (
      <div className="center-box">
        <p>Sua conta não tem perfil de acesso. Fale com o suporte.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    )
  }

  return (
    <AdminCtx.Provider value={{ profile: profile!, restaurant: restaurant!, reloadRestaurant: load }}>
      <header className="topnav">
        <span className="brand">📋 {restaurant!.name}</span>
        <nav>
          <NavLink to="/escala">Escala</NavLink>
          <NavLink to="/pessoas">Pessoas</NavLink>
          <NavLink to="/relatorios">Relatórios</NavLink>
          <NavLink to="/config">Config</NavLink>
        </nav>
        <button
          className="btn-link"
          onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
        >
          Sair
        </button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </AdminCtx.Provider>
  )
}
