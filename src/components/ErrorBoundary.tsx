import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Shown in the fallback so the operator knows which surface died. */
  surface: string
  /** Optional reset hook — e.g. re-mount a map after a WebGL context loss. */
  onReset?: () => void
}

interface State {
  error: Error | null
}

/**
 * Catches render failures in a chart surface. One broken feed or a WebGL
 * context loss should not blank the whole dashboard, which is what happened
 * before any boundary existed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[CanalPulse] ${this.props.surface} failed`, error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="surface-error" role="alert">
        <span className="surface-error__kicker">SURFACE FAULT</span>
        <strong>{this.props.surface} 渲染失败</strong>
        <p>{error.message || '未捕获的渲染错误'}</p>
        <button type="button" onClick={this.reset}>
          重新加载该面板
        </button>
        <em>其余面板不受影响，可继续使用。</em>
      </div>
    )
  }
}
