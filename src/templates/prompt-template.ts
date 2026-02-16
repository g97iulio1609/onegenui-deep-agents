const PARTIAL_RE = /\{\{>(\w+)\}\}/g;
const VARIABLE_RE = /\{\{(\w+)\}\}/g;

const FILTER_RE = /\{\{(\w+(?:\.\w+)*)\s*\|([^}]+)\}\}/g;

const BLOCKED_PROPS = new Set(['__proto__', 'constructor', 'prototype']);
const KEYWORDS = new Set(['if', 'else', 'unless', 'each', 'this']);

function findMatchingClose(template: string, openTag: string, closeTag: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;
  while (i < template.length) {
    if (template.startsWith(openTag, i)) {
      depth++;
      i += openTag.length;
    } else if (template.startsWith(closeTag, i)) {
      depth--;
      if (depth === 0) return i;
      i += closeTag.length;
    } else {
      i++;
    }
  }
  return -1;
}

function replaceAtDepth0(body: string, regex: RegExp, replacement: string | ((match: string, ...args: string[]) => string)): string {
  // Protect nested {{#each}}...{{/each}} blocks from replacement
  const nested: string[] = [];
  let protected_ = body;
  const eachOpenRe = /\{\{#each\s+\w+\}\}/;
  let m: RegExpMatchArray | null;
  while ((m = eachOpenRe.exec(protected_)) !== null) {
    const start = m.index!;
    const bodyStart = start + m[0].length;
    const closeIndex = findMatchingClose(protected_, '{{#each', '{{/each}}', bodyStart);
    if (closeIndex === -1) break;
    const end = closeIndex + '{{/each}}'.length;
    const block = protected_.slice(start, end);
    const placeholder = `__NESTED_EACH_${nested.length}__`;
    nested.push(block);
    protected_ = protected_.slice(0, start) + placeholder + protected_.slice(end);
  }
  // Apply replacement only at depth 0
  if (typeof replacement === 'string') {
    protected_ = protected_.replace(regex, replacement);
  } else {
    protected_ = protected_.replace(regex, replacement as (...args: string[]) => string);
  }
  // Restore nested blocks
  for (let i = nested.length - 1; i >= 0; i--) {
    protected_ = protected_.replace(`__NESTED_EACH_${i}__`, nested[i]);
  }
  return protected_;
}

function findElseAtDepth0(body: string): number {
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    if (body.startsWith('{{#if', i) || body.startsWith('{{#unless', i)) {
      depth++;
      i += body.startsWith('{{#if', i) ? 5 : 9;
    } else if (body.startsWith('{{/if}}', i) || body.startsWith('{{/unless}}', i)) {
      depth--;
      i += body.startsWith('{{/if}}', i) ? 7 : 11;
    } else if (body.startsWith('{{else}}', i) && depth === 0) {
      return i;
    } else {
      i++;
    }
  }
  return -1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateValue = string | number | boolean | null | undefined | any[] | Record<string, any>;

export interface PromptTemplateConfig {
  template: string;
  variables?: Record<string, TemplateValue>;
  partials?: Record<string, PromptTemplate>;
}

type FilterFn = (value: string, ...args: string[]) => string;

const BUILTIN_FILTERS: Record<string, FilterFn> = {
  uppercase: (v) => v.toUpperCase(),
  lowercase: (v) => v.toLowerCase(),
  trim: (v) => v.trim(),
  json: (v) => {
    try { return JSON.stringify(JSON.parse(v)); } catch { return JSON.stringify(v); }
  },
  default: (v, fallback) => (v === '' || v === 'undefined' || v === 'null') ? fallback : v,
};

export class PromptTemplate {
  constructor(private readonly config: PromptTemplateConfig) {}

  compile(overrides?: Record<string, TemplateValue>): string {
    const variables: Record<string, TemplateValue> = { ...this.config.variables, ...overrides };
    let compiled = this.config.template;

    // 1. Handle partials first {{>partialName}}
    compiled = compiled.replace(PARTIAL_RE, (_match, partialName) => {
      const partial = this.config.partials?.[partialName];
      if (!partial) {
        throw new Error(`Partial "${partialName}" not found`);
      }
      return partial.compile(variables);
    });

    // 2. Handle loops {{#each items}}...{{/each}}
    compiled = this.processLoops(compiled, variables);

    // 3. Handle conditionals {{#if}}...{{/if}} and {{#unless}}...{{/unless}}
    compiled = this.processConditionals(compiled, variables);

    // 4. Handle filters {{var | filter}}
    compiled = this.processFilters(compiled, variables);

    // 5. Handle variables {{var}}
    compiled = compiled.replace(VARIABLE_RE, (_match, varName) => {
      if (!(varName in variables)) {
        throw new Error(`Required variable "${varName}" is missing`);
      }
      return String(variables[varName]);
    });

    return compiled;
  }

  private processLoops(template: string, variables: Record<string, TemplateValue>): string {
    const openRe = /\{\{#each\s+(\w+)\}\}/;
    let result = template;
    let match: RegExpMatchArray | null;
    while ((match = openRe.exec(result)) !== null) {
      const varName = match[1];
      const bodyStart = match.index! + match[0].length;
      const closeIndex = findMatchingClose(result, '{{#each', '{{/each}}', bodyStart);
      if (closeIndex === -1) break;
      const body = result.slice(bodyStart, closeIndex);
      const items = variables[varName];
      let replacement = '';
      if (Array.isArray(items)) {
        replacement = items.map((item, index) => {
          let r = body;
          r = replaceAtDepth0(r, /\{\{@index\}\}/g, String(index));
          r = replaceAtDepth0(r, /\{\{this\.(\w+)\}\}/g, (_m: string, prop: string) => {
            if (item != null && typeof item === 'object' && Object.hasOwn(item as object, prop)) {
              return String(item[prop]);
            }
            return '';
          });
          r = replaceAtDepth0(r, /\{\{this\}\}/g, String(item));
          r = this.processConditionals(r, variables);
          return r;
        }).join('');
      }
      result = result.slice(0, match.index!) + replacement + result.slice(closeIndex + '{{/each}}'.length);
    }
    return result;
  }

  private processConditionals(template: string, variables: Record<string, TemplateValue>): string {
    let compiled = template;

    // Handle {{#unless condition}}...{{/unless}}
    const unlessRe = /\{\{#unless\s+(\w+)\}\}/;
    let match: RegExpMatchArray | null;
    while ((match = unlessRe.exec(compiled)) !== null) {
      const varName = match[1];
      const bodyStart = match.index! + match[0].length;
      const closeIndex = findMatchingClose(compiled, '{{#unless', '{{/unless}}', bodyStart);
      if (closeIndex === -1) break;
      const body = compiled.slice(bodyStart, closeIndex);
      const value = variables[varName];
      const replacement = !value ? body : '';
      compiled = compiled.slice(0, match.index!) + replacement + compiled.slice(closeIndex + '{{/unless}}'.length);
    }

    // Handle {{#if condition}}...{{else}}...{{/if}} and {{#if condition}}...{{/if}}
    const ifRe = /\{\{#if\s+(\w+)\}\}/;
    while ((match = ifRe.exec(compiled)) !== null) {
      const varName = match[1];
      const bodyStart = match.index! + match[0].length;
      const closeIndex = findMatchingClose(compiled, '{{#if', '{{/if}}', bodyStart);
      if (closeIndex === -1) break;
      const body = compiled.slice(bodyStart, closeIndex);
      const value = variables[varName];
      const elseIndex = findElseAtDepth0(body);
      let replacement: string;
      if (elseIndex !== -1) {
        const trueBranch = body.slice(0, elseIndex);
        const falseBranch = body.slice(elseIndex + '{{else}}'.length);
        replacement = value ? trueBranch : falseBranch;
      } else {
        replacement = value ? body : '';
      }
      compiled = compiled.slice(0, match.index!) + replacement + compiled.slice(closeIndex + '{{/if}}'.length);
    }

    return compiled;
  }

  private processFilters(template: string, variables: Record<string, TemplateValue>): string {
    return template.replace(FILTER_RE, (_match, varPath, filterChain) => {
      // Resolve variable value (supports dot notation for nested access)
      let value: TemplateValue;
      if (varPath.includes('.')) {
        const parts = varPath.split('.');
        value = variables[parts[0]];
        for (let i = 1; i < parts.length && value != null; i++) {
          if (BLOCKED_PROPS.has(parts[i])) { return ''; }
          value = (value as Record<string, TemplateValue>)[parts[i]];
        }
      } else {
        value = variables[varPath];
      }

      let result = value != null ? String(value) : '';

      // Apply filter chain
      const filters = (filterChain as string).split('|').map((f: string) => f.trim());
      for (const filterExpr of filters) {
        const parenMatch = filterExpr.match(/^(\w+)\(([^)]*)\)$/);
        const filterName = parenMatch ? parenMatch[1] : filterExpr;
        const args = parenMatch ? [parenMatch[2].replace(/^['"]|['"]$/g, '')] : [];
        const filterFn = BUILTIN_FILTERS[filterName];
        if (filterFn) {
          result = filterFn(result, ...args);
        }
      }

      return result;
    });
  }

  extend(overrides: Partial<PromptTemplateConfig>): PromptTemplate {
    return new PromptTemplate({
      template: overrides.template ?? this.config.template,
      variables: { ...this.config.variables, ...overrides.variables } as Record<string, TemplateValue>,
      partials: { ...this.config.partials, ...overrides.partials }
    });
  }

  get requiredVariables(): string[] {
    const variables = new Set<string>();
    
    // Extract variables from template
    const variableMatches = this.config.template.match(VARIABLE_RE) || [];
    variableMatches.forEach(match => {
      const varName = match.slice(2, -2);
      if (!varName.startsWith('>') && !KEYWORDS.has(varName)) {
        variables.add(varName);
      }
    });

    // Extract variables from partials
    if (this.config.partials) {
      Object.values(this.config.partials).forEach(partial => {
        partial.requiredVariables.forEach(varName => variables.add(varName));
      });
    }

    return Array.from(variables).sort();
  }

  static from(template: string): PromptTemplate {
    return new PromptTemplate({ template });
  }
}