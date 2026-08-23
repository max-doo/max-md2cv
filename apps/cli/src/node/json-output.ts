import { EXIT_CODE_BY_ERROR, asMd2cvError } from "./errors";

export interface CliErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    suggestions: string[];
  };
}

export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

export const printError = (error: unknown, json: boolean): number => {
  const normalized = asMd2cvError(error);
  const payload: CliErrorPayload = {
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      suggestions: normalized.suggestions,
    },
  };

  if (json) {
    printJson(payload);
  } else {
    process.stderr.write(`[${normalized.code}] ${normalized.message}\n`);
    if (normalized.suggestions.length > 0) {
      process.stderr.write(normalized.suggestions.map((suggestion) => `  - ${suggestion}`).join("\n") + "\n");
    }
  }

  return EXIT_CODE_BY_ERROR[normalized.code];
};
