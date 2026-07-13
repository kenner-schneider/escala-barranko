import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminShell } from './components/AdminShell'
import { FreeShell } from './components/FreeShell'
import { Config } from './pages/admin/Config'
import { Escala } from './pages/admin/Escala'
import { Login } from './pages/admin/Login'
import { Pessoas } from './pages/admin/Pessoas'
import { Presenca } from './pages/admin/Presenca'
import { Relatorios } from './pages/admin/Relatorios'
import { Convite } from './pages/free/Convite'
import { Disponibilidade } from './pages/free/Disponibilidade'
import { Entrar } from './pages/free/Entrar'
import { MinhaEscala } from './pages/free/MinhaEscala'
import { RootPage } from './pages/root/RootPage'
import { FlaskIcon } from './components/icons'
import { DEMO_MODE } from './lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      {/* Texturas globais (grão + halo de acento) */}
      <div className="halo" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      {DEMO_MODE && (
        <div className="demo-banner">
          <FlaskIcon size={15} /> Modo demonstração — dados fictícios em memória. Qualquer e-mail/senha entra como
          gerente (comece com "root" p/ Root); FREE: telefone 5511999990001 + qualquer PIN.
        </div>
      )}
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AdminShell />}>
            <Route path="/escala" element={<Escala />} />
            <Route path="/presenca" element={<Presenca />} />
            <Route path="/pessoas" element={<Pessoas />} />
            <Route path="/config" element={<Config />} />
            <Route path="/relatorios" element={<Relatorios />} />
          </Route>
          <Route path="/root" element={<RootPage />} />
          <Route path="/convite/:token" element={<Convite />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route element={<FreeShell />}>
            <Route path="/disponibilidade" element={<Disponibilidade />} />
            <Route path="/minha-escala" element={<MinhaEscala />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
