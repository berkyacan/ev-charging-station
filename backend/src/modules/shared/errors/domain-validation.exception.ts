import { BadRequestException } from '@nestjs/common';
import { ApiErrorResponse } from '../types/api-response.type';

export interface DomainValidationErrorDetails
  extends Record<string, unknown> {}

export class DomainValidationException extends BadRequestException {
  constructor(
    message: string,
    code = 'DOMAIN_VALIDATION_ERROR',
    details?: DomainValidationErrorDetails,
  ) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };

    super(response);
  }
}
