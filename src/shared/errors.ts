import type { JsonObject, ToolExecutionResult } from "./types.js";

export class AppError extends Error {
  public readonly code: string;
  public readonly details?: JsonObject;

  public constructor(code: string, message: string, details?: JsonObject, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class ConfigurationError extends AppError {
  public constructor(message: string, details?: JsonObject, options?: ErrorOptions) {
    super("CONFIGURATION_ERROR", message, details, options);
  }
}

export class ToolNotImplementedError extends AppError {
  public constructor(toolName: string, details?: JsonObject, options?: ErrorOptions) {
    super(
      "TOOL_NOT_IMPLEMENTED",
      `${toolName} is not implemented in the TypeScript scaffold yet.`,
      {
        tool: toolName,
        ...details,
      },
      options,
    );
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export function createNotImplementedToolResult(
  toolName: string,
  details: JsonObject = {},
): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text: `${toolName} is scaffolded in TypeScript but not implemented yet. Use the existing Python server for runtime behavior.`,
      },
    ],
    structuredContent: {
      status: "not_implemented",
      tool: toolName,
      ...details,
    },
    isError: true,
  };
}

export function createToolResult(
  text: string,
  structuredContent?: JsonObject,
  isError = false,
): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    ...(structuredContent ? { structuredContent } : {}),
    ...(isError ? { isError: true } : {}),
  };
}
