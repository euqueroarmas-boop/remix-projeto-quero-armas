import React, { Component, ErrorInfo, ReactNode } from "react";
import { logSistema } from "@/lib/logSistema";
import { buildWmtiError, formatErrorForClipboard, type WmtiError } from "@/lib/errorLogger";
import { isChunkError } from "@/lib/lazyRetry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  wmtiError: WmtiError | null;
  copied: boolean;
  isChunkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, wmtiError: null, copied: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isChunkError: isChunkError(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const wmtiErr = buildWmtiError({
      action: this.state.isChunkError ? "ChunkLoadError" : "ErrorBoundary",
      message: error.message,
      error,
    });

    this.setState({ wmtiError: wmtiErr });

    logSistema({
      tipo: "erro",
      status: "error",
      mensagem: `[${this.state.isChunkError ? "ChunkLoadError" : "ErrorBoundary"}] ${error.message}`,
      payload: {
        stack: error.stack?.substring(0, 2000),
        componentStack: errorInfo.componentStack?.substring(0, 2000),
        url: window.location.href,
        browser_info: wmtiErr.browserInfo,
        is_chunk_error: this.state.isChunkError,
      },
    });
  }

  handleCopy = async () => {
    if (!this.state.wmtiError) return;
    try {
      await navigator.clipboard.writeText(formatErrorForClipboard(this.state.wmtiError));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {}
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { isChunkError: isChunk } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="text-5xl">{isChunk ? "🔄" : "⚠️"}</div>
            <h1 className="text-xl font-bold text-foreground">
              {isChunk ? "Atualização detectada" : "Algo deu errado"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isChunk
                ? "Uma nova versão do site foi publicada. Recarregue a página para continuar navegando."
                : "Ocorreu um erro inesperado. Tente recarregar a página."}
            </p>
            {!isChunk && this.state.error && (
              <p className="text-xs text-destructive font-mono bg-destructive/10 p-2 rounded break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
              >
                Recarregar página
              </button>
              {this.state.wmtiError && (
                <button
                  onClick={this.handleCopy}
                  className="px-4 py-2 border border-border text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors"
                >
                  {this.state.copied ? "✓ Copiado!" : "📋 Copiar erro para suporte"}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
