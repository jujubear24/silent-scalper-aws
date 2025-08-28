'use client';

import { useState } from 'react';
import RecordTable from "@/app/components/RecordTable";

export default function Home() {
  const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || "";
  // Read the API key from environment variables
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(oldKey => oldKey + 1);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 sm:p-24 bg-gray-50 dark:bg-gray-900">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm mb-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 dark:text-white">
          Silent Scalper Dashboard
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mt-2">
          Processed File Records
        </p>
      </div>

      <div className="w-full max-w-5xl mb-4 flex justify-end">
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-150 ease-in-out"
        >
          Refresh Data
        </button>
      </div>

      <div className="w-full max-w-5xl">
        {API_ENDPOINT ? (
          // Pass the API key as a prop to the table component
          <RecordTable key={refreshKey} apiUrl={`${API_ENDPOINT}/records`} apiKey={API_KEY} />
        ) : (
          <p className="text-center text-red-500">
            API endpoint is not configured. Please set NEXT_PUBLIC_API_ENDPOINT in your .env.local file.
          </p>
        )}
      </div>
    </main>
  );
}