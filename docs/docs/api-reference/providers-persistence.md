---
sidebar_position: 3
---

# Providers API Reference

Official provider adapters for Gauss. Import from `gauss/providers`.

## openai

```typescript
import { openai } from "gauss/providers";
const model = openai(modelId: string, options?: OpenAIProviderOptions);
```

**Parameters:**
- `modelId` — Model identifier (e.g., `"gpt-4o"`, `"gpt-4o-mini"`)
- `options.apiKey` — API key (default: `OPENAI_API_KEY` env)
- `options.baseURL` — Custom base URL
- `options.organization` — OpenAI organization ID

## anthropic

```typescript
import { anthropic } from "gauss/providers";
const model = anthropic(modelId: string, options?: AnthropicProviderOptions);
```

**Parameters:**
- `modelId` — Model identifier (e.g., `"claude-sonnet-4-20250514"`)
- `options.apiKey` — API key (default: `ANTHROPIC_API_KEY` env)

## google

```typescript
import { google } from "gauss/providers";
const model = google(modelId: string, options?: GoogleProviderOptions);
```

**Parameters:**
- `modelId` — Model identifier (e.g., `"gemini-2.0-flash"`)
- `options.apiKey` — API key (default: `GOOGLE_GENERATIVE_AI_API_KEY` env)

## groq

```typescript
import { groq } from "gauss/providers";
const model = groq(modelId: string, options?: GroqProviderOptions);
```

**Parameters:**
- `modelId` — Model identifier (e.g., `"llama-3.3-70b-versatile"`)
- `options.apiKey` — API key (default: `GROQ_API_KEY` env)

## ollama

```typescript
import { ollama } from "gauss/providers";
const model = ollama(modelId: string, options?: OllamaProviderOptions);
```

**Parameters:**
- `modelId` — Local model name (e.g., `"llama3.2"`, `"mistral"`)
- `options.baseURL` — Ollama server URL (default: `http://localhost:11434/v1`)

No API key required. Runs locally.

## openrouter

```typescript
import { openrouter } from "gauss/providers";
const model = openrouter(modelId: string, options?: OpenRouterProviderOptions);
```

**Parameters:**
- `modelId` — Provider/model path (e.g., `"anthropic/claude-sonnet-4-20250514"`)
- `options.apiKey` — API key (default: `OPENROUTER_API_KEY` env)
- `options.baseURL` — Custom base URL

---

# Persistence API Reference

## PostgresStorageAdapter

```typescript
import { PostgresStorageAdapter } from "gauss";

const storage = new PostgresStorageAdapter({
  connectionString: string;   // PostgreSQL connection string
  tableName?: string;          // Default: 'gauss_storage'
  schema?: string;             // Default: 'public'
  poolSize?: number;           // Default: 10
});
await storage.initialize();    // Creates table if not exists
```

Implements `StorageDomainPort`.

## RedisStorageAdapter

```typescript
import { RedisStorageAdapter } from "gauss";

const storage = new RedisStorageAdapter({
  url?: string;       // Default: 'redis://localhost:6379'
  prefix?: string;    // Key prefix. Default: 'gauss'
  ttl?: number;       // TTL in seconds. Default: 0 (no expiry)
});
await storage.initialize();
```

Implements `StorageDomainPort`.

## PgVectorStoreAdapter

```typescript
import { PgVectorStoreAdapter } from "gauss";

const store = new PgVectorStoreAdapter({
  connectionString: string;
  tableName?: string;          // Default: 'gauss_vectors'
  dimensions?: number;         // Default: 1536
  useHnsw?: boolean;           // Default: true
});
await store.initialize();      // Creates extension + table + index
```

Implements `VectorStorePort`.

## S3ObjectStorageAdapter

```typescript
import { S3ObjectStorageAdapter } from "gauss";

const s3 = new S3ObjectStorageAdapter({
  bucket: string;
  region?: string;
  prefix?: string;             // Key prefix
  endpoint?: string;           // For MinIO, R2, etc.
  forcePathStyle?: boolean;    // For MinIO
});
```

Implements `ObjectStoragePort`.

## BullMQQueueAdapter

```typescript
import { BullMQQueueAdapter } from "gauss";

const queue = new BullMQQueueAdapter({
  queueName: string;
  redisUrl?: string;           // Default: 'redis://localhost:6379'
  defaultJobOptions?: QueueJobOptions;
});
```

Implements `QueuePort`.
