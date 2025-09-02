"use client";

import { useState, ChangeEvent } from "react";

// Define a type for the expected API response for a presigned URL.
interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

// Define the props that this component accepts.
interface FileUploaderProps {
  apiEndpoint: string;
  apiKey: string;
  onUploadSuccess: () => void; // Callback to refresh the table
}

export default function FileUploader({
  apiEndpoint,
  apiKey,
  onUploadSuccess,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("Select a file to begin.");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus("idle");
      setMessage(selectedFile.name);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    setStatus("uploading");
    setMessage("Getting upload link...");

    try {
      // Step 1: Get the presigned URL from our API
      const presignedUrlResponse = await fetch(`${apiEndpoint}/uploads`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          // FIX: Add Content-Type header
          "Content-Type": "application/json",
        },
        // FIX: Add the fileName to the request body
        body: JSON.stringify({
          fileName: file.name,
        }),
      });

      if (!presignedUrlResponse.ok) {
        throw new Error("Could not get a presigned URL.");
      }

      const { uploadUrl }: PresignedUrlResponse =
        await presignedUrlResponse.json();
      setMessage("Uploading file...");

      // Step 2: Upload the file directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          // The Content-Type header might be required by the presigned URL
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to S3.");
      }

      setStatus("success");
      setMessage("Upload successful!");
      onUploadSuccess(); // Trigger the refresh in the parent component
    } catch (err) {
      setStatus("error");
      if (err instanceof Error) {
        setMessage(`Upload failed: ${err.message}`);
      } else {
        setMessage("An unknown error occurred during upload.");
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        Upload a New File
      </h2>
      <div className="flex items-center space-x-4">
        <label className="w-full">
          <span className="sr-only">Choose file</span>
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </label>
        <button
          onClick={handleUpload}
          disabled={!file || status === "uploading"}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Uploading..." : "Upload"}
        </button>
      </div>
      {status !== "idle" && (
        <p
          className={`mt-3 text-sm ${
            status === "error"
              ? "text-red-600"
              : status === "success"
              ? "text-green-600"
              : "text-gray-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
