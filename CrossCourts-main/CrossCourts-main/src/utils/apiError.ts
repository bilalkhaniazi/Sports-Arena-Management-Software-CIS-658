import axios from "axios";

type ErrorBody = { message?: string; error?: string };

const GENERIC_SERVER = /^internal server error$/i;

function genericHttp500Hint(): string {
  return (
    "HTTP 500 with no useful error text: usually MySQL is not running on port 3306. " +
    "Start MySQL (XAMPP or MySQL service), set DB_PASSWORD in .env to match root (XAMPP is often empty), " +
    "then run cross_courts_backend/backend/bootstrap-db.bat and start-api.bat. " +
    "If npm fails in PowerShell, use Command Prompt or npm.cmd."
  );
}

function normalizeGenericServerMessage(text: string): string {
  if (GENERIC_SERVER.test(text.trim())) {
    return genericHttp500Hint();
  }
  return text;
}

/**
 * Reads backend JSON from axios errors (supports both `message` and `error` keys).
 */
export function getAxiosErrorMessage(
  err: unknown,
  options: {
    noResponse: string;
    fallback: string;
  },
): string {
  if (!axios.isAxiosError(err)) {
    return options.fallback;
  }
  if (!err.response) {
    return options.noResponse;
  }

  const data = err.response.data;
  let msg: string | undefined;

  if (typeof data === "string") {
    const t = data.trim();
    if (t && !t.startsWith("<")) {
      msg = normalizeGenericServerMessage(t);
    }
  } else if (data && typeof data === "object") {
    const body = data as ErrorBody;
    const raw = body.message ?? body.error;
    if (typeof raw === "string" && raw.trim()) {
      msg = normalizeGenericServerMessage(raw);
    }
  }

  if (msg) {
    return msg;
  }

  const status = err.response.status;
  if (status === 401) {
    return "Invalid email or password.";
  }
  if (status >= 500) {
    const st = (err.response.statusText || "").trim();
    if (!st || GENERIC_SERVER.test(st)) {
      return genericHttp500Hint();
    }
    return normalizeGenericServerMessage(st);
  }

  return options.fallback;
}
