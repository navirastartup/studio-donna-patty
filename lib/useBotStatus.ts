import { useEffect, useState } from "react";

export function useBotStatus() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/bot-status");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setData({ error: true });
      }
      setLoading(false);
    }

    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading };
}
