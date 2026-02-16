import type { ValidationPort } from "../../ports/validation.port.js";
import { ZodValidationAdapter } from "../../adapters/validation/zod-validation.adapter.js";

/** Resolve the validator from plugin options, defaulting to ZodValidationAdapter. */
export function getValidator(options: { validator?: ValidationPort }): ValidationPort {
  return options.validator ?? new ZodValidationAdapter();
}
