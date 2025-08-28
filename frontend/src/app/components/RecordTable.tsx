'use client';

import { useState, useEffect } from 'react';

type Record = {
  recordId: string;
  fileName: string;
  fileSize: number;
  sourceBucket: string;
};

type RecordTableProps = {
  apiUrl: string;
  apiKey: string; // Add a prop for the API key
};

export default function RecordTable({ apiUrl, apiKey }: RecordTableProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      // Check if the API key is provided before making a request
      if (!apiKey) {
        setError("API Key is not configured.");
        setIsLoading(false);
        return;
      }

      try {
        // Create request headers and add the API key
        const headers = new Headers();
        headers.append('x-api-key', apiKey);

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          // Provide more specific error messages
          if (response.status === 403) {
            throw new Error('Forbidden: Invalid API Key.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Record[] = await response.json();
        setRecords(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [apiUrl, apiKey]);

  if (isLoading) {
    return <p className="text-center text-gray-500">Loading records...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500">Error: {error}</p>;
  }

  if (records.length === 0) {
    return <p className="text-center text-gray-500">No records found.</p>;
  }
  
  return (
    <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="py-3 px-6">File Name</th>
            <th scope="col" className="py-3 px-6">File Size (Bytes)</th>
            <th scope="col" className="py-3 px-6">Source Bucket</th>
            <th scope="col" className="py-3 px-6">Record ID</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.recordId} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
              <th scope="row" className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                {record.fileName}
              </th>
              <td className="py-4 px-6">{record.fileSize}</td>
              <td className="py-4 px-6">{record.sourceBucket}</td>
              <td className="py-4 px-6">{record.recordId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


