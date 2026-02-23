## Miranda

Miranda is a case research workspace built on AWS Amplify, emphasizing easy setup for authentication, API, and database capabilities.

## Overview

Miranda delivers a focused experience for reviewing cases and managing metadata, with AWS services like Cognito, AppSync, and DynamoDB pre-configured for scalability and performance.

## Features

- **Authentication**: Setup with Amazon Cognito for secure user authentication.
- **API**: Ready-to-use GraphQL endpoint with AWS AppSync.
- **Database**: Real-time database powered by Amazon DynamoDB.

## Canonical Case Links

- Canonical opinion/case links should use `/case/:caseId`.
- At runtime, `/case/:caseId` is auth-aware and resolves to:
  - guest: `/pub/case/:caseId`
  - authenticated non-admin: `/sub/case/:caseId`
  - authenticated admin: `/admin/case/:caseId`
- Query string is preserved on redirect. Hash is preserved for in-app navigation.
- Case ID validation is format-agnostic across courts (for example `2026_00963` and `24A102`) and blocks invalid/path-traversal-like values.
- Authorization remains enforced by scoped routes and data auth policy; canonical routing is only a URL resolver.

## Deploying to AWS

For detailed instructions on deploying your application, refer to the [Amplify deployment documentation](https://docs.amplify.aws/).

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
