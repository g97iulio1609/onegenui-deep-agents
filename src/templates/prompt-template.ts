export interface PromptTemplateConfig {
  template: string;
  variables?: Record<string, string | number | boolean>;
  partials?: Record<string, PromptTemplate>;
}

export class PromptTemplate {
  constructor(private readonly config: PromptTemplateConfig) {}

  compile(overrides?: Record<string, string | number | boolean>): string {
    const variables = { ...this.config.variables, ...overrides };
    let compiled = this.config.template;

    // Handle partials first {{>partialName}}
    compiled = compiled.replace(/\{\{>(\w+)\}\}/g, (match, partialName) => {
      const partial = this.config.partials?.[partialName];
      if (!partial) {
        throw new Error(`Partial "${partialName}" not found`);
      }
      return partial.compile(variables);
    });

    // Handle variables {{var}}
    compiled = compiled.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (!(varName in variables)) {
        throw new Error(`Required variable "${varName}" is missing`);
      }
      return String(variables[varName]);
    });

    return compiled;
  }

  extend(overrides: Partial<PromptTemplateConfig>): PromptTemplate {
    return new PromptTemplate({
      template: overrides.template ?? this.config.template,
      variables: { ...this.config.variables, ...overrides.variables },
      partials: { ...this.config.partials, ...overrides.partials }
    });
  }

  get requiredVariables(): string[] {
    const variables = new Set<string>();
    
    // Extract variables from template
    const variableMatches = this.config.template.match(/\{\{(\w+)\}\}/g) || [];
    variableMatches.forEach(match => {
      const varName = match.slice(2, -2);
      if (!varName.startsWith('>')) { // Skip partials
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