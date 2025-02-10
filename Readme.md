# OSFF - Open Serverless Function Framework 🌩️

A cloud-agnostic serverless framework that lets developers focus on business logic while automating infrastructure deployment. Built with TypeScript, currently supporting **AWS Lambda** and **standalone API** services with **HTTP REST API** and **WebSocket** capabilities.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/lang-typescript-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- **Multi-cloud support** (AWS Lambda implemented, more coming)
- **Single configuration file** (`app-config.json`) driven
- **Infrastructure as Code** with AWS CDK integration
- **Environment-aware deployments** (local/dev/production)
- **HTTP & WebSocket API support**
- **Custom Authorizers**
- **VPC Configuration**
- **Automatic environment variable management**
- **TypeScript-first development**

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- AWS CDK installed (`npm install -g aws-cdk`)
- AWS credentials configured (for cloud deployments)
- TypeScript 4.7+

### Installation
```
git clone project-git-url
```

## 📖 Quick Start

1. **Initialize your project**
```bash
mkdir osff
cd osff
npm init -y
```

2. **Create your first function**
`src/lambda-handler/hello.ts`:
```typescript
export const handler = async (event: any) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Serverless!" })
  };
};
```

3. **Configure `app-config.json`**
```json
{
  "appName": "My Serverless App",
  "stage": "dev",
  "provider": "aws",
  "functions": [{
    "name": "hello-dev",
    "runtime": "lambda.Runtime.NODEJS_22_X",
    "handler": "index.handler",
    "srcFile": "src/lambda-handler/hello.ts",
    "triggers": [{
      "type": "http",
      "endpoint": "/hello",
      "method": "GET"
    }]
  }]
}
```

4. **Build & Deploy**
```bash
# Build TypeScript files
npm run build

# Deploy infrastructure
cdk deploy
```

## ⚙️ Configuration Guide

The `app-config.json` is the single source of truth:

### Core Structure
```json5
{
  "appName": "string",         // Application name
  "version": "string",         // App version
  "region": "string",          // Cloud provider region
  "stage": "string",           // Deployment stage (local|dev|production)
  "provider": "string",        // Cloud provider (aws)
  "envFile": { /* ... */ },    // Environment files per stage
  "authorizer": [ /* ... */ ], // Custom authorizers
  "vpc": [ /* ... */ ],        // VPC configurations
  "apiGateway": [ /* ... */ ], // HTTP API configurations
  "websocketApi": [ /* ... */ ], // WebSocket API configs
  "functions": [ /* ... */ ]   // Serverless functions
}
```

### Key Features

#### Environment Variables
```json
"envFile": {
  "local": "../environment/.local.env",
  "dev": "../environment/.dev.env",
  "production": "../environment/.production.env"
}
```

#### Function Configuration
```json
{
  "name": "function-name-${self.stage}",
  "runtime": "lambda.Runtime.NODEJS_22_X",
  "handler": "index.handler",
  "srcFile": "path/to/source.ts",
  "triggers": [{
    "type": "http|websocket",
    "endpoint": "/your-route",
    "method": "GET|POST|PUT|DELETE",
    "authorizer": "custom-auth"
  }],
  "environmentVariable": {
    "KEY": "value ${env.VAR}"
  }
}
```

#### WebSocket Support
```json
"websocketApi": [{
  "name": "my-ws-api-${self.stage}",
  "routeSelectionExpression": "$request.body.action",
  "stageName": "${self.stage}"
}]
```

## 🛠️ Deployment

### Build Project
```bash
npm run build
```

### Deploy to AWS
```bash
cdk bootstrap
cdk deploy
```

### Environment-specific Deployment
```bash
STAGE=production cdk deploy
```

## 🌐 Environment Variables

Use `.env` files with variable substitution:
```env
frontendUrl=https://yourapp.com
cors=https://yourapp.com,http://localhost:3000
```

Access in config:
```json
"${env.frontendUrl}"
```

## 📚 Examples

### HTTP Function
```json
{
  "name": "user-api-${self.stage}",
  "runtime": "lambda.Runtime.NODEJS_22_X",
  "handler": "index.handler",
  "srcFile": "src/user/handler.ts",
  "triggers": [{
    "type": "http",
    "endpoint": "/users",
    "method": "POST",
    "authorizer": "custom-auth"
  }]
}
```

### WebSocket Function
```json
{
  "name": "chat-handler-${self.stage}",
  "triggers": [{
    "type": "websocket",
    "endpoint": "$default"
  }]
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contribution Guidelines](CONTRIBUTING.md).

## ❓ Support

Open an issue or reach out via [email/discord/slack channel].

## License

MIT © [Your Name]


