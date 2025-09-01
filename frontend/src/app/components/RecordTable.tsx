"use client";

import { useEffect, useState } from "react";

// Define a type for the structure of our processed records.
interface ProcessedRecord {
  recordId: string;
  fileName: string;
  sourceBucket: string;
  fileSize: number;
}

// Define the props that this component accepts.
interface RecordTableProps {
  apiEndpoint: string;
  apiKey: string;
  refreshKey: number; // A key to trigger a re-fetch
}

export default function RecordTable({
  apiEndpoint,
  apiKey,
  refreshKey,
}: RecordTableProps) {
  const [records, setRecords] = useState<ProcessedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoading(true);
      setError(null);

      if (!apiEndpoint || !apiKey) {
        setError("API endpoint or key is not configured.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${apiEndpoint}/records`, {
          headers: {
            "x-api-key": apiKey,
          },
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data: ProcessedRecord[] = await response.json();
        setRecords(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(`Failed to fetch records: ${err.message}`);
        } else {
          setError("An unknown error occurred while fetching records.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [apiEndpoint, apiKey, refreshKey]); // Re-run effect when refreshKey changes

  const handleViewClick = async (fileName: string) => {
    try {
      const response = await fetch(
        `${apiEndpoint}/downloads?fileName=${encodeURIComponent(fileName)}`,
        {
          headers: {
            "x-api-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Could not get download link.");
      }

      const data = await response.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch (err) {
      if (err instanceof Error) {
        alert(`Error: ${err.message}`);
      } else {
        alert("An unknown error occurred.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Loading records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative my-4">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              File Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              File Size (Bytes)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {records.length > 0 ? (
            records.map((record) => (
              <tr key={record.recordId}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                  {record.fileName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                  {record.fileSize.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleViewClick(record.fileName)}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={3}
                className="px-6 py-4 text-center text-sm text-gray-500"
              >
                No records found. Upload a file to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}



