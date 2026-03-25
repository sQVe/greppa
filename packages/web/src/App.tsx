import { useEffect, useState } from "react";

interface HealthResponse {
  status: string;
}

export const App = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to fetch health"),
      );
  }, []);

  if (error != null) {
    return <div>Error: {error}</div>;
  }

  if (health == null) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Greppa</h1>
      <p>Server status: {health.status}</p>
    </div>
  );
};
