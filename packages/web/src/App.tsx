import { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
}

export const App = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data: HealthResponse = await response.json();
        setHealth(data);
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch health');
      }
    };
    void fetchHealth();
  }, []);

  if (errorMessage != null) {
    return <div>Error: {errorMessage}</div>;
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
