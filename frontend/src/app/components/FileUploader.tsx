'use client';

import { useState, ChangeEvent } from 'react';

type FileUploaderProps = {
  apiUrl: string;
  apiKey: string;
  onUploadSuccess: () => void; // A function to call when upload is successful
};

export default function FileUploader({ apiUrl, apiKey, onUploadSuccess }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadMessage(''); // Clear previous messages
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setUploadMessage('Getting upload URL...');

    try {
      // Step 1: Get the presigned URL from our API
      const apiHeaders = new Headers();
      apiHeaders.append('x-api-key', apiKey);
      apiHeaders.append('Content-Type', 'application/json');

      const presignedUrlResponse = await fetch(`${apiUrl}/uploads`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ fileName: selectedFile.name }),
      });

      if (!presignedUrlResponse.ok) {
        throw new Error('Could not get an upload URL.');
      }

      const { uploadUrl } = await presignedUrlResponse.json();
      setUploadMessage('Uploading file...');

      // Step 2: Upload the file directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          // Note: For some file types, you might need to set 'Content-Type' here
          // e.g., 'Content-Type': selectedFile.type
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('File upload to S3 failed.');
      }

      setUploadMessage('Upload successful! Refresh the table to see your file.');
      onUploadSuccess(); // Notify the parent component
      setSelectedFile(null); // Clear the file input

    } catch (error: any) {
      setUploadMessage(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-md dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upload a New File</h3>
      <div className="flex items-center space-x-4">
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
          disabled={isUploading}
        />
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="px-4 py-2 text-white font-semibold bg-green-600 rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition duration-150 ease-in-out"
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      {uploadMessage && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{uploadMessage}</p>
      )}
    </div>
  );
} 