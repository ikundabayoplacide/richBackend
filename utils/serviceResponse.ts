import type { Response } from "express";
import { sendResponse } from "./httpHandlers";

export interface IServiceResponse<T = any> {
  success: boolean;
  message: string;
  result: T | null;
  statusCode: number;
  [key: string]: any; // For additional custom fields
}

export class ServiceResponse<T = any, E = Record<string, unknown>> implements IServiceResponse<T> {
  success: boolean;
  message: string;
  result: T | null;
  statusCode: number;
  [key: string]: any; // For additional custom fields

  private constructor(init: Partial<IServiceResponse<T>>) {
    this.success = init.success ?? false;
    this.message = init.message ?? '';
    this.result = init.result ?? null;
    this.statusCode = init.statusCode ?? 200;
    
    // Add any additional custom fields
    if (init) {
      Object.keys(init).forEach(key => {
        if (!['success', 'message', 'result', 'statusCode'].includes(key)) {
          this[key] = init[key as keyof IServiceResponse<T>];
        }
      });
    }
  }

  static success<T>(
    message: string = 'Operation completed successfully',
    result: T | null = null,
    statusCode: number = 200,
    customFields: Record<string, any> = {}
  ): ServiceResponse<T> {
    return new ServiceResponse<T>({
      success: true,
      message,
      result,
      statusCode,
      ...customFields
    });
  }

  static successWithExtra<T, E>(
    message: string,
    result: T | null,
    extra: E,
    statusCode: number = 200
  ): ServiceResponse<T, E> {
    return new ServiceResponse<T, E>({
      success: true,
      message,
      result,
      statusCode,
      ...extra
    });
  }

  static failure<T>(
    message: string = 'An error occurred',
    result: T | null = null,
    statusCode: number = 400,
    customFields: Record<string, any> = {}
  ): ServiceResponse<T> {
    return new ServiceResponse<T>({
      success: false,
      message,
      result,
      statusCode,
      ...customFields
    });
  }

  static send<T>(
    response: Response,
    serviceResponse: ServiceResponse<T>
  ): Response {
    return sendResponse(serviceResponse, response);
  }
}
