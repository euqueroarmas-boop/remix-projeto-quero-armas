import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export function usePrivateStorageUrl(bucket: string, path: string | null | undefined, expiresIn = 3600) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSignedUrl() {
      if (!path) {
        setUrl(null);
        return;
      }

      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

      if (!active) return;
      if (error) {
        setUrl(null);
        return;
      }

      setUrl(data?.signedUrl || null);
    }

    void loadSignedUrl();

    return () => {
      active = false;
    };
  }, [bucket, expiresIn, path]);

  return url;
}