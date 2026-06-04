import { logSistema } from "@/lib/logSistema";

export interface AppError {
  timestamp: string;
  route: string;
  action: string;
  message: string;
  technicalMessage: string;
  stack?: string;
  quoteId?: string;
  contractId?: string;
  customerId?: string;
  paymentId?: string;
  functionName?: string;
  httpStatus?: number;
  responseBody?: string;
  browserInfo: string;
}

function getBrowserInfo(): string {
  try {
    return `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`;
  } catch {
    return "unknown";
  }
}

export function buildAppError(params: {
  action: string;
  message: string;
  technicalMessage?: string;
  error?: unknown;
  quoteId?: string;
  contractId?: string;
  customerId?: string;
  paymentId?: string;
  functionName?: string;
  httpStatus?: number;
  responseBody?: string;
}): AppError {
  const err = params.error instanceof Error ? params.error : null;
  return {
    timestamp: new Date().toISOString(),
    route: window.location.pathname + window.location.search,
    action: params.action,
    message: params.message,
    technicalMessage: params.technicalMessage || err?.message || String(params.error || ""),
    stack: err?.stack?.substring(0, 2000),
    quoteId: params.quoteId,
    contractId: params.contractId,
    customerId: params.customerId,
    paymentId: params.paymentId,
    functionName: params.functionName,
    httpStatus: params.httpStatus,
    responseBody: params.responseBody?.substring(0, 1000),
    browserInfo: getBrowserInfo(),
  };
}

export function formatErrorForClipboard(err: AppError): string {
  return `[ERRO QUERO ARMAS]
Horário: ${err.timestamp}
Rota: ${err.route}
Ação: ${err.action}
Mensagem: ${err.message}
Erro técnico: ${err.technicalMessage}
Quote ID: ${err.quoteId || "—"}
Contract ID: ${err.contractId || "—"}
Customer ID: ${err.customerId || "—"}
Payment ID: ${err.paymentId || "—"}
Function: ${err.functionName || "—"}
Status HTTP: ${err.httpStatus || "—"}
Stack: ${err.stack || "—"}
Contexto: ${err.browserInfo}`;
}

export async function logAndPersistError(params: Parameters<typeof buildAppError>[0]): Promise<AppError> {
  const appErr = buildAppError(params);

  await logSistema({
    tipo: "erro",
    status: "error",
    mensagem: `[${params.action}] ${params.message}`,
    payload: {
      route: appErr.route,
      action: appErr.action,
      technical_message: appErr.technicalMessage,
      stack: appErr.stack,
      quote_id: appErr.quoteId,
      contract_id: appErr.contractId,
      customer_id: appErr.customerId,
      payment_id: appErr.paymentId,
      function_name: appErr.functionName,
      http_status: appErr.httpStatus,
      response_body: appErr.responseBody,
      browser_info: appErr.browserInfo,
    },
  });

  return appErr;
}

export async function copyErrorToClipboard(err: AppError): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatErrorForClipboard(err));
    return true;
  } catch {
    return false;
  }
}

// Global unhandled error capture
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    logAndPersistError({
      action: "window.onerror",
      message: event.message || "Erro global não tratado",
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logAndPersistError({
      action: "unhandledrejection",
      message: reason?.message || "Promise rejeitada sem tratamento",
      error: reason,
    });
  });
}
