export interface StructuredOutputPort {
  /** Parse and validate raw LLM output against a schema */
  parse<T>(raw: string, schema: OutputSchema<T>): ParseResult<T>;

  /** Attempt to repair malformed output */
  repair<T>(
    raw: string,
    schema: OutputSchema<T>,
    errors: ValidationError[],
  ): RepairResult<T>;

  /** Create a system prompt suffix that instructs LLM to output structured data */
  formatInstruction<T>(
    schema: OutputSchema<T>,
    options?: FormatOptions,
  ): string;

  /** Validate a parsed value against constraints */
  validate<T>(
    value: T,
    constraints: OutputConstraint<T>[],
  ): ValidationResult;

  /** Stream-parse partial output */
  parseStream<T>(schema: OutputSchema<T>): StreamParser<T>;
}

export interface OutputSchema<T> {
  readonly type: 'json' | 'yaml' | 'xml' | 'csv' | 'markdown-table';
  readonly definition: Record<string, unknown>;
  readonly description?: string;
  readonly examples?: T[];
}

export interface ParseResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: ValidationError[];
  readonly raw: string;
}

export interface RepairResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly repaired: string;
  readonly repairs: RepairAction[];
}

export interface RepairAction {
  readonly type:
    | 'fix_json'
    | 'add_missing_field'
    | 'remove_extra_field'
    | 'fix_type'
    | 'fix_encoding';
  readonly field?: string;
  readonly description: string;
}

export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface OutputConstraint<T> {
  readonly field: string;
  readonly check: (value: unknown) => boolean;
  readonly message: string;
}

export interface FormatOptions {
  readonly style: 'concise' | 'detailed' | 'with-examples';
  readonly wrapInCodeBlock?: boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ValidationError[];
}

export interface StreamParser<T> {
  /** Feed a chunk of text */
  feed(chunk: string): void;

  /** Get current partial parse result */
  current(): Partial<T> | null;

  /** Check if parsing is complete */
  isComplete(): boolean;

  /** Get final result */
  finalize(): ParseResult<T>;
}
