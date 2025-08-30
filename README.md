# Silent Scalper - A Serverless Data Processing Pipeline on AWS
**Live Demo:** <https://main.d27mjzbws6y41f.amplifyapp.com/>


## 1. The Business Problem
Cloud-based companies often face two critical, costly issues with poorly designed data architectures:

1. **Wasted Resources:** Provisioned servers sit idle during periods of low traffic, burning cash without providing value.

2. **System Failures:** Sudden spikes in traffic overwhelm under-provisioned systems, causing crashes, data loss, and a poor user experience.

The "**Silent Scalper**" project is a production-ready, serverless pipeline designed to solve this problem by creating a system that is both cost-efficient and infinitely scalable. It operates on a pay-per-use model, ensuring you only pay for the compute time you actually use, and it automatically scales to handle any workload, from a single file to millions.

## 2. Architecture
This project is built on a robust, event-driven architecture using core AWS services. The entire infrastructure is managed declaratively using Terraform (Infrastructure as Code).

```mermaid
 subgraph Ingestion_Flow["📥 Data Ingestion & Processing"]
        B["S3: incoming-data"]
        A["User via Browser"]
        C["Lambda: File Processor"]
        D["DynamoDB: Processed Data"]
        E["S3: Quarantine"]
        F["CloudWatch Alarms"]
        G["SNS Topic"]
        H["Administrator"]
        n1["Untitled Node"]
  end
 subgraph Retrieval_Flow["📤 Data Retrieval"]
        J["API Gateway"]
        I["User via Frontend"]
        K["Lambda: Records Reader"]
  end
    A -- "1. Upload File" --> B
    B -- "2. Event Notification" --> C
    C -- "3a. Success" --> D
    C -- "3b. Failure" --> E
    C -- "4. On Error" --> F
    F -- "5. Trigger Alert" --> G
    G -- "6. Send Email" --> H
    I -- "7. Request Data" --> J
    J -- "8. Proxy Request" --> K
    K -- "9. Scan Table" --> D
    D -- "10. Return Items" --> K
    K -- "11. Return JSON" --> J
    J -- "12. Return Data" --> I
    A --> n1

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#ccf,stroke:#333,stroke-width:1.5px
    style C fill:#cfc,stroke:#333,stroke-width:1.5px
    style D fill:#ccf,stroke:#333,stroke-width:1.5px
    style E fill:#ccf,stroke:#333,stroke-width:1.5px
    style F fill:#ffc,stroke:#333,stroke-width:1.5px
    style G fill:#ffc,stroke:#333,stroke-width:1.5px
    style H fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#f9f,stroke:#333,stroke-width:2px
    style K fill:#cfc,stroke:#333,stroke-width:1.5px
```
## 3. Core Features

* **Event-Driven Processing**: The entire pipeline is triggered automatically when a new file is uploaded to the S3 bucket.

* **Cost-Efficient & Scalable**: Leverages a fully serverless design with AWS Lambda, S3, and DynamoDB, scaling from zero to handle any workload on a pay-per-use basis.

* **Infrastructure as Code (IaC)**: All AWS resources are defined and managed using Terraform, ensuring consistent, repeatable, and version-controlled deployments.

* **Robust Error Handling**: Failed processing attempts don't break the system. Instead, problematic files are automatically moved to a separate quarantine bucket for manual inspection.

* **Automated Monitoring & Alerting**: A CloudWatch alarm monitors the processing Lambda for errors. If the error rate spikes, an alert is automatically sent via SNS to an administrator's email.

* **Secure, Rate-Limited API**: A REST API built with API Gateway provides access to the processed data. The endpoint is secured with an API Key and Usage Plan to prevent unauthorized access and control costs with rate limiting.

* **Secure Frontend Uploads**: The frontend uses a secure pattern of generating S3 presigned URLs, allowing users to upload files directly from the browser to S3 without the data passing through a server.

* **Modern Frontend**: A responsive user interface built with Next.js, TypeScript, and Tailwind CSS provides a dashboard to view processed records and upload new files.

## 4. Technology Stack

| Category | Technology |
|----------|------------|
|Infrastructure | Terraform, AWS|
| Backend |  Python, Boto3 |
| Frontend | Next.js, React, TypeScript, Tailwind CSS | 
| AWS Services | S3, Lambda, DynamoDB, API Gateway, CloudWatch, SNS, IAM, AWS Amplify |
|Source Control | GitHub |

## 5. Project Structure

The repository is organized as a monorepo to separate the infrastructure code from the frontend application code.

```.
├── infrastructure/      # Contains all Terraform (.tf) and Lambda (.py) source code.
└── frontend/            # Contains the Next.js and TypeScript source code for the UI.
```

## 6. Local Setup and Installation

### Prerequisites

* [Terraform](https://developer.hashicorp.com/terraform/install) installed.

* [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured with your AWS credentials.

* [Node.js](https://nodejs.org/en) (v18 or later) and npm installed.

### Backend Deployment

1. **Navigate to the infrastructure directory**:

    ```
    cd infrastructure
    ```

2. **Initialize Terraform**: 
(This downloads the necessary provider plugins)
    ```
    terraform init
    ```

3. **Deploy the AWS resources**:
(You must update the placeholder email in main.tf first)
    ```
    terraform apply
    ```
After the apply is complete, Terraform will output the API Gateway endpoint URL. You will need this for the frontend setup.

### Frontend Setup

1. **Navigate to the frontend directory**:
    ```
    cd frontend
    ```

2. **Install dependencies**:
    ```
    npm ci
    ```

3. **Create the environment file**:

    Create a new file named ```.env.local``` in the ```/frontend``` directory.

4. **Add environment variables**:

    Get the API Key from the AWS API Gateway console and the endpoint URL from the Terraform output, then add them to your ```.env.local``` file:
    
    ```
    NEXT_PUBLIC_API_ENDPOINT= https://your-api-url.execute-api.us-east-2.amazonaws.com/prod

    NEXT_PUBLIC_API_KEY=yourSecretApiKeyCopiedFromAWS
    ```

5. **Run the development server**:

    ```
    npm run dev
    ```

Open <http://localhost:3000> to view the application.

## 7. Frontend Deployment

The frontend application is deployed and hosted using AWS Amplify. The deployment is automatically triggered on every push to the main branch of this GitHub repository. The build settings are configured in the ```amplify.yml``` file in the Amplify console.

## 8. License

This project is licensed under the MIT License. See the LICENSE file for details.

## 9. Author

**Jules Bahanyi** - [https://github.com/jujubear24] - [https://www.linkedin.com/in/jules-bahanyi/]
