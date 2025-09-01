"use client";

import { useState } from "react";
import FileUploader from "./components/FileUploader";
import RecordTable from "./components/RecordTable";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || "";
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

  const handleRefresh = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Silent Scalper Dashboard
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-600">
            A serverless data processing pipeline for efficient, scalable file
            management.
          </p>
        </header>

        <section className="space-y-12">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Upload a New File
            </h2>
            <FileUploader
              apiEndpoint={API_ENDPOINT}
              apiKey={API_KEY}
              onUploadSuccess={handleRefresh}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                Processed Records
              </h2>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-x-2 px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
                  />
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                </svg>
                Refresh Data
              </button>
            </div>
            <RecordTable
              apiEndpoint={API_ENDPOINT}
              apiKey={API_KEY}
              refreshKey={refreshKey}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
