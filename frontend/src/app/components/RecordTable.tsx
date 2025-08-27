'use client'; 

import { useState, useEffect } from 'react';

// Define a type for our record objects for better TypeScript support.
type Record = {
  recordId: string;
  fileName: string;
  fileSize: number;
  sourceBucket: string;
};

// Define the props for our component, which will include the API endpoint URL.
type RecordTableProps = {
  apiUrl: string;
};

export default function RecordTable({ apiUrl }: RecordTableProps) {
  // State to store the records fetched from the API
  const [records, setRecords] = useState<Record[]>([]);
  // State to handle loading status
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // State to handle any potential errors during fetching
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Define an async function to fetch the data
    const fetchRecords = async () => {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Record[] = await response.json();
        setRecords(data);
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError('An unknown error occurred');
        }
      } finally {
        // Set loading to false once the fetch is complete (either success or error)
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [apiUrl]); // The effect will re-run if the apiUrl prop ever changes.

  // Display a loading message while fetching data
  if (isLoading) {
    return <p className="text-center text-gray-500">Loading records...</p>;
  }

  // Display an error message if the fetch failed
  if (error) {
    return <p className="text-center text-red-500">Error: {error}</p>;
  }

  // Display a message if no records are found
  if (records.length === 0) {
    return <p className="text-center text-gray-500">No records found. Try uploading a file to the S3 bucket.</p>;
  }

  // Render the table with the fetched data
  return (
    <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="py-3 px-6">
              File Name
            </th>
            <th scope="col" className="py-3 px-6">
              File Size (Bytes)
            </th>
            <th scope="col" className="py-3 px-6">
              Source Bucket
            </th>
            <th scope="col" className="py-3 px-6">
              Record ID
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.recordId} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
              <th scope="row" className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                {record.fileName}
              </th>
              <td className="py-4 px-6">
                {record.fileSize}
              </td>
              <td className="py-4 px-6">
                {record.sourceBucket}
              </td>
              <td className="py-4 px-6">
                {record.recordId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
