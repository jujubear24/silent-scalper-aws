'use client';

import { useState } from 'react';
import FileUploader from '@/app/components/FileUploader';
import RecordTable from '@/app/components/RecordTable';

// These values are loaded from the .env.local file.
// Make sure they are prefixed with NEXT_PUBLIC_
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || '';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

export default function Home() {
  // We use a key to force the RecordTable component to re-mount and re-fetch data.
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  if (!API_ENDPOINT || !API_KEY) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg max-w-lg">
          <h1 className="text-xl font-bold text-red-700">Configuration Error</h1>
          <p className="mt-2 text-red-600">
            The API endpoint or API key is not configured. Please create a <code>.env.local</code> file in the <code>/frontend</code> directory and add your <code>NEXT_PUBLIC_API_ENDPOINT</code> and <code>NEXT_PUBLIC_API_KEY</code>.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-12 md:p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-12">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gray-200 p-4 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Silent Scalper Dashboard
        </p>
      </div>

      <div className="w-full max-w-5xl space-y-8">
        {/* Add the FileUploader component here */}
        <FileUploader
          apiEndpoint={API_ENDPOINT} // Corrected prop name from apiUrl to apiEndpoint
          apiKey={API_KEY}
          onUploadSuccess={handleRefresh} // Automatically refresh the table on success
        />

        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Processed Records</h1>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-semibold text-sm shadow-sm hover:bg-gray-50 transition-colors"
          >
            Refresh Data
          </button>
        </div>
        
        <RecordTable key={refreshKey} apiEndpoint={API_ENDPOINT} apiKey={API_KEY} />
      </div>
    </main>
  );
}
