/**
 * Simple CF Workers KV Cache Service
 */
export async function getFromCache(kv: any, key: string): Promise<string | null> {
  if (!kv) return null;
  try {
    return await kv.get(key);
  } catch (e) {
    return null;
  }
}

export async function saveToCache(kv: any, key: string, value: string): Promise<void> {
  if (!kv) return;
  try {
    // Cache for 30 days
    await kv.put(key, value, { expirationTtl: 60 * 60 * 24 * 30 });
  } catch (e) {
    // fail silently
  }
}
