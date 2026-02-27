# Gauss — Rename & Standardization Plan

## Overview

The package was renamed from `@onegenui/agent` to `gauss` but internal class names, filenames, and references are still inconsistent. This plan covers the complete standardization.

---

## 1. Public API — Exported Classes & Interfaces (Breaking Changes)

| Current | New | File | Lines |
|---------|-----|------|-------|
| `OneAgentServer` | `GaussServer` | `src/rest/server.ts` | 16 |
| `OneAgentServer` | `GaussServer` | `src/rest/index.ts` | 5 |
| `OneAgentServer` | `GaussServer` | `src/index.ts` | 399 |
| `OneAgentConfig` | `GaussConfig` | `src/cli/config.ts` | 11, 21, 26, 37 |
| `OnegenUiMcpAdapter` | `GaussMcpAdapter` | `src/adapters/mcp/onegenui-mcp.adapter.ts` | 17 |
| `OnegenUiMcpAdapter` | `GaussMcpAdapter` | `src/adapters/mcp/index.ts` | 1 |
| `OnegenUiMcpAdapter` | `GaussMcpAdapter` | `src/index.ts` | 245 |

> ⚠️ These are breaking changes. Consider re-exporting old names as deprecated aliases:
> ```typescript
> /** @deprecated Use GaussServer */
> export const OneAgentServer = GaussServer;
> ```

---

## 2. Filenames to Rename

| Current | New |
|---------|-----|
| `src/adapters/mcp/onegenui-mcp.adapter.ts` | `src/adapters/mcp/gaussflow-mcp.adapter.ts` |
| `src/types/onegenui-mcp.d.ts` | `src/types/gaussflow-mcp.d.ts` |

All imports referencing these files must be updated accordingly.

---

## 3. Comments & Internal References

| File | Line(s) | Current | New |
|------|---------|---------|-----|
| `src/rest/server.ts` | 2 | `// REST API — OneAgentServer` | `// REST API — GaussServer` |
| `src/adapters/mcp/onegenui-mcp.adapter.ts` | 1 | `// OnegenUiMcpAdapter — Adapter bridging…` | `// GaussMcpAdapter — Adapter bridging…` |

---

## 4. Tests

| File | Lines | What to change |
|------|-------|----------------|
| `src/rest/__tests__/server.test.ts` | 8, 192, 193, 198, 382, 383, 388 | `OneAgentServer` → `GaussServer` |

---

## 5. Examples

| File | Lines | What to change |
|------|-------|----------------|
| `examples/09-cli-and-rest.ts` | 7, 9 | `OneAgentServer` → `GaussServer` |

---

## 6. README.md

| Line | Current | New |
|------|---------|-----|
| 109 | `│OnegenUiMcp│` | `│GaussMcp│` |
| 169 | `onegenui-mcp.adapter.ts` | `gaussflow-mcp.adapter.ts` |
| 997 | `OnegenUiMcpAdapter` | `GaussMcpAdapter` |
| 1433 | `import { OneAgentServer }` | `import { GaussServer }` |
| 1435 | `new OneAgentServer({` | `new GaussServer({` |

---

## 7. Documentation (`docs/`)

| File | What to change |
|------|----------------|
| `docs/docusaurus.config.ts:15` | `baseUrl: '/onegenui-deep-agents/'` → update se il repo viene rinominato |
| `docs/docusaurus.config.ts:18` | `projectName: 'onegenui-deep-agents'` → idem |
| `docs/docusaurus.config.ts:34,63,90` | URL GitHub: `g97iulio1609/onegenui-deep-agents` → `giulio-leone/...` |
| `docs/docs/api-reference/adapters.md:232,237,239` | `OnegenUiMcpAdapter` → `GaussMcpAdapter` |
| `docs/docs/architecture.md:38` | `│OnegenUiMcp│` → `│GaussMcp│` |
| `docs/docs/rest-api.md:12,14` | `OneAgentServer` → `GaussServer` |

---

## 8. Repository & Infra

| Item | Current | New | Note |
|------|---------|-----|------|
| GitHub repo name | `onegenui-deep-agents` | `gaussflow-agent` (opzionale) | Richiede rename manuale su GitHub Settings |
| `package.json` repository URL | `onegenui-deep-agents.git` | Aggiornare se il repo viene rinominato |
| GitHub Pages base URL | `/onegenui-deep-agents/` | Aggiornare se il repo viene rinominato |
| Deploy docs workflow | Paths OK | Aggiornare se il repo viene rinominato |

---

## 9. Cosa NON rinominare

| Nome | Motivo |
|------|--------|
| `Agent` (classe) | Nome del core agent, intenzionalmente diverso dal brand del pacchetto |
| `deep-agent.ts` (file) | Coerente con il nome della classe |
| `AgentBuilder` | Idem |
| Nomi di port/adapter generici | Già corretti (`RuntimePort`, `MemoryPort`, etc.) |

---

## Execution Checklist

- [ ] Rename file `onegenui-mcp.adapter.ts` → `gaussflow-mcp.adapter.ts`
- [ ] Rename file `onegenui-mcp.d.ts` → `gaussflow-mcp.d.ts`
- [ ] Rename class `OnegenUiMcpAdapter` → `GaussMcpAdapter`
- [ ] Rename class `OneAgentServer` → `GaussServer`
- [ ] Rename interface `OneAgentConfig` → `GaussConfig`
- [ ] Update all imports/re-exports
- [ ] Update all tests
- [ ] Update examples
- [ ] Update README.md
- [ ] Update docs/
- [ ] Add deprecated aliases for backward compatibility
- [ ] Fix `g97iulio1609` → `giulio-leone` in docs URLs
- [ ] Run tests (412 must pass)
- [ ] Run build
- [ ] 2 consecutive clean code reviews
