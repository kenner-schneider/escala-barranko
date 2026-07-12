import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="center-box">
          <h1>Algo deu errado</h1>
          <p className="muted">
            Um erro inesperado aconteceu. Recarregue a página — seus dados publicados estão salvos.
          </p>
          <button className="btn primary" onClick={() => location.reload()}>
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
