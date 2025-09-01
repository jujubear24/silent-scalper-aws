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
      <div className="flex justify-center items-center p-8 my-4">
        <svg
          className="animate-spin h-8 w-8 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="ml-3 text-gray-500 text-lg">Loading records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg my-4" role="alert">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden shadow-lg border border-gray-200/80 rounded-xl">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-700 text-gray-100">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
            >
              File Name
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
            >
              File Size (Bytes)
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {records.length > 0 ? (
            records.map((record) => (
              <tr
                key={record.recordId}
                className="hover:bg-gray-50 transition-colors duration-200"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {record.fileName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {record.fileSize.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleViewClick(record.fileName)}
                    className="inline-flex items-center gap-x-2 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm hover:shadow-md"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                    >
                      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
                      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                    </svg>
                    View
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={3}
                className="px-6 py-8 text-center text-sm text-gray-500"
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



