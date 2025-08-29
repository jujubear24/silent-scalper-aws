'use client';

import { useState, useRef } from 'react';

// Define a specific type for the API response to avoid using 'any'
interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

interface FileUploaderProps {
  apiKey: string;
  apiEndpoint: string;
  onUploadSuccess: () => void;
}

export default function FileUploader({ apiKey, apiEndpoint, onUploadSuccess }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('Select a file to begin.');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setMessage(`Ready to upload: ${selectedFile.name}`);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first.');
      return;
    }

    setStatus('uploading');
    setMessage('Requesting upload URL...');

    try {
      // 1. Get a presigned URL from our API
      const response = await fetch(`${apiEndpoint}/uploads`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: file.name }),
      });

      if (!response.ok) {
        throw new Error('Failed to get presigned URL from server.');
      }

      const data: PresignedUrlResponse = await response.json();
      setMessage('Uploading file to S3...');

      // 2. Upload the file directly to S3 using the presigned URL
      const s3Response = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
      });

      if (!s3Response.ok) {
        throw new Error('Failed to upload file to S3.');
      }

      setStatus('success');
      setMessage(`Upload successful! File is now being processed.`);
      onUploadSuccess(); // Notify the parent component

    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('error');
      if (error instanceof Error) {
        setMessage(`Upload failed: ${error.message}`);
      } else {
        setMessage('An unknown error occurred during upload.');
      }
    } finally {
        // Reset file input to allow re-uploading the same file
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setFile(null);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload a New File</h2>
      <div className="flex items-center space-x-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          onClick={handleUpload}
          disabled={!file || status === 'uploading'}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold text-sm shadow-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'uploading' ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      <p className={`mt-3 text-sm ${getStatusColor()}`}>{message}</p>
    </div>
  );
}
