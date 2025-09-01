"use client";

import { useState, useRef } from "react";

// Define a type for the structure of the presigned URL API response.
interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

// Define the props that this component accepts.
interface FileUploaderProps {
  apiEndpoint: string;
  apiKey: string;
  onUploadSuccess: () => void; // Callback to refresh the parent's data
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
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
    setMessage("Preparing upload...");

    try {
      // 1. Get a presigned URL from our API
      const presignedUrlResponse = await fetch(
        `${apiEndpoint}/uploads?fileName=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
          },
        }
      );

      if (!presignedUrlResponse.ok) {
        throw new Error("Could not get an upload URL from the server.");
      }

      const { uploadUrl }: PresignedUrlResponse =
        await presignedUrlResponse.json();
      setMessage("Uploading file...");

      // 2. Upload the file directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to S3.");
      }

      setStatus("success");
      setMessage("Upload successful! Refreshing records...");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // 3. Notify the parent component to refresh the data
      setTimeout(() => {
        onUploadSuccess();
        setStatus("idle");
        setMessage("Select a file to begin.");
      }, 1500); // Give user time to see success message
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
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-gray-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-grow">
          <label
            htmlFor="file-upload"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Select File
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              id="file-upload"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
            >
              Choose File
            </label>
            <span className="text-sm text-gray-500 truncate" title={file?.name}>
              {file ? file.name : "No file chosen"}
            </span>
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || status === "uploading"}
          className="w-full sm:w-auto inline-flex justify-center items-center gap-x-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm hover:shadow-md"
        >
          {status === "uploading" ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
              Uploading...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="-ml-1 mr-2 h-5 w-5"
                viewBox="0 0 16 16"
              >
                <path
                  fillRule="evenodd"
                  d="M8 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0v-8A.5.5 0 0 1 8 0z"
                />
                <path
                  fillRule="evenodd"
                  d="M.854 11.854a.5.5 0 0 0 .708 0L8 5.707l6.438 6.147a.5.5 0 0 0 .708-.708l-6.788-6.47a.5.5 0 0 0-.708 0l-6.788 6.47a.5.5 0 0 0 0 .708z"
                />
              </svg>
              Upload
            </>
          )}
        </button>
      </div>
      {status !== "idle" && (
        <div className="mt-4 text-sm text-center">
          <p
            className={`${
              status === "error"
                ? "text-red-600"
                : status === "success"
                ? "text-green-600"
                : "text-gray-600"
            }`}
          >
            {message}
          </p>
        </div>
      )}
    </div>
  );
}