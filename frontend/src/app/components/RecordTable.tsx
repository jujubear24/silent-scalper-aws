'use client';

import { useEffect, useState } from 'react';

// Define a specific type for our records to avoid using 'any'
interface ProcessedRecord {
  recordId: string;
  fileName: string;
  sourceBucket: string;
  fileSize: number;
}

interface RecordTableProps {
  apiKey: string;
  apiEndpoint: string;
}

export default function RecordTable({ apiKey, apiEndpoint }: RecordTableProps) {
  const [records, setRecords] = useState<ProcessedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiEndpoint}/records`, {
          headers: {
            'x-api-key': apiKey,
          },
        });
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data: ProcessedRecord[] = await response.json();
        setRecords(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [apiKey, apiEndpoint]);

  if (loading) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Loading records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 font-semibold">Error: Failed to fetch records</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 border rounded-lg">
        <p className="text-gray-600">No records found.</p>
        <p className="text-gray-400 text-sm mt-1">Upload a file to see its data here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Size (Bytes)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {records.map((record) => (
            <tr key={record.recordId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{record.fileName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.fileSize.toLocaleString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.recordId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



