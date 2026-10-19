import { ApiClientError } from '../api';

export function translateUiMessage(message: string): string {
  const trimmedMessage = message.trim();

  if (trimmedMessage === '') {
    return '';
  }

  return trimmedMessage;
}

export function translateUiMessages(messages: string[]): string[] {
  return messages.map((message) => translateUiMessage(message));
}

export function extractTranslatedApiMessages(
  error: unknown,
  fallbackMessage: string,
): string[] {
  const translatedFallbackMessage = translateUiMessage(fallbackMessage);

  if (!(error instanceof ApiClientError)) {
    return [translatedFallbackMessage];
  }

  const details = error.details;

  if (
    typeof details === 'object' &&
    details !== null &&
    'error' in details &&
    typeof details.error === 'object' &&
    details.error !== null
  ) {
    const nestedError = details.error as {
      details?: { errors?: unknown };
      message?: unknown;
    };

    if (
      nestedError.details &&
      Array.isArray(nestedError.details.errors) &&
      nestedError.details.errors.every((message) => typeof message === 'string')
    ) {
      return dedupeMessages(
        translateUiMessages(nestedError.details.errors as string[]),
      );
    }

    if (
      typeof nestedError.message === 'string' &&
      nestedError.message.trim() !== ''
    ) {
      return dedupeMessages(
        translateUiMessages(
          nestedError.message
            .split(';')
            .map((message) => message.trim())
            .filter(Boolean),
        ),
      );
    }
  }

  if (
    typeof details === 'object' &&
    details !== null &&
    'message' in details
  ) {
    const message = details.message;

    if (Array.isArray(message)) {
      return dedupeMessages(
        translateUiMessages(
          message.filter((item): item is string => typeof item === 'string'),
        ),
      );
    }

    if (typeof message === 'string' && message.trim() !== '') {
      return [translateUiMessage(message)];
    }
  }

  if (error.message.trim() !== '') {
    return [translateUiMessage(error.message)];
  }

  return [translatedFallbackMessage];
}

function dedupeMessages(messages: string[]): string[] {
  return Array.from(new Set(messages));
}
