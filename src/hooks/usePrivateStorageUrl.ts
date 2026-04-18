import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * In-memory cache of signed URLs. Avoids re-issuing signed URLs every time the
 * same image is rendered in another page/component during the same session.
 * Each entry expires shortly before the underlying signed URL does so we never
 * serve a broken link.
 */
type CacheEntry = { url: string; expiresAt: number };
const urlCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(bucket: string, path: string) {
  return `${bucket}::${path}`;
}

async function fetchSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
    .then(({ data, error }) => {
      const url = !error && data?.signedUrl ? data.signedUrl : null;
      if (url) {
        urlCache.set(key, {
          url,
          // Expire 60s before the real signed URL to avoid edge cases.
          expiresAt: Date.now() + (expiresIn - 60) * 1000,
        });
      }
      inflight.delete(key);
      return url;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });

  inflight.set(key, promise);
  return promise;
}

export function usePrivateStorageUrl(bucket: string, path: string | null | undefined, expiresIn = 3600) {
  const initial = path ? urlCache.get(cacheKey(bucket, path))?.url ?? null : null;
  const [url, setUrl] = useState<string | null>(initial);

  useEffect(() => {
    let active = true;

    if (!path) {
      setUrl(null);
      return;
    }

    const cached = urlCache.get(cacheKey(bucket, path));
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
      return;
    }

    void fetchSignedUrl(bucket, path, expiresIn).then(next => {
      if (active) setUrl(next);
    });

    return () => {
      active = false;
    };
  }, [bucket, expiresIn, path]);

  return url;
}