// =============================================================================
// A2A Push Notifications — Webhook-based Push Notifications
// =============================================================================

import type { A2ATaskEvent } from "./a2a-handler.js";

export interface PushNotificationConfig {
  url: string;
  headers?: Record<string, string>;
  events?: A2ATaskEvent['type'][];
}

export class A2APushNotifier {
  private readonly subscriptions = new Map<string, PushNotificationConfig[]>();
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = globalThis.fetch) {
    if (!fetchImpl) {
      throw new Error("A2APushNotifier requires a fetch implementation");
    }
    this.fetchImpl = fetchImpl;
  }

  private static readonly BLOCKED_HEADERS = new Set(['host', 'authorization', 'cookie', 'content-type']);
  private static readonly LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

  subscribe(taskId: string, config: PushNotificationConfig): void {
    const parsed = new URL(config.url);
    const isLocal = A2APushNotifier.LOCAL_HOSTS.has(parsed.hostname)
      || parsed.hostname.startsWith('127.');
    if (parsed.protocol !== 'https:' && !isLocal) {
      throw new Error('Push notification URL must use HTTPS');
    }
    // Block non-HTTPS access to any local address except explicit localhost
    if (parsed.protocol !== 'https:' && isLocal && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      throw new Error('Push notification URL must use HTTPS for non-standard local addresses');
    }

    // Sanitize headers — block security-sensitive headers
    if (config.headers) {
      for (const key of Object.keys(config.headers)) {
        if (A2APushNotifier.BLOCKED_HEADERS.has(key.toLowerCase())) {
          throw new Error(`Header "${key}" is not allowed in push notifications`);
        }
      }
    }

    const existing = this.subscriptions.get(taskId) ?? [];
    existing.push(config);
    this.subscriptions.set(taskId, existing);
  }

  unsubscribe(taskId: string, url: string): void {
    const existing = this.subscriptions.get(taskId) ?? [];
    const filtered = existing.filter(config => config.url !== url);
    
    if (filtered.length === 0) {
      this.subscriptions.delete(taskId);
    } else {
      this.subscriptions.set(taskId, filtered);
    }
  }

  async notify(event: A2ATaskEvent): Promise<void> {
    const configs = this.subscriptions.get(event.taskId) ?? [];
    
    const promises = configs.map(async (config) => {
      // Skip if this event type is not in the config's event filter
      if (config.events && !config.events.includes(event.type)) {
        return;
      }

      try {
        await this.fetchImpl(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...config.headers
          },
          body: JSON.stringify(event)
        });
      } catch (error) {
        // Log but don't throw - failed webhooks shouldn't break the main flow
        console.warn(`Push notification failed for ${config.url}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  cleanup(taskId: string): void {
    this.subscriptions.delete(taskId);
  }
}