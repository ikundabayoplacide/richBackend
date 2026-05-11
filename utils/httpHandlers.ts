import type { Response } from "express";
import { ServiceResponse } from "./serviceResponse";

export const sendResponse = (serviceResponse: ServiceResponse<any>, response: Response): Response => {
  const { statusCode, success, message, result, ...rest } = serviceResponse;
  return response.status(statusCode).json({
    ...rest,
    success,
    message,
    result
  });
};
