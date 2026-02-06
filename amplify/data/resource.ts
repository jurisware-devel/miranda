import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*== STEP 1 ===============================================================
The section below defines the core models for cases and tagging.
Case IDs use the existing unique prefix (e.g. "2025_00904").
=========================================================================*/
const schema = a.schema({
  Case: a
    .model({
      caseId: a.string().required(),
      caseName: a.string().required(),
      slipOp: a.string(),
      ny3dCite: a.string(),
      opinionUrl: a.string().required(),
      court: a.string(),
      decisionDate: a.date(),
      arguedDate: a.date(),
      correctedDate: a.date(),
      citation: a.string(),
      lowerCourtCite: a.string(),
      disposition: a.string(),
      authoringJudge: a.string(),
      partiesCaption: a.string(),
      statutesCited: a.string().array(),
      summary: a.string(),
    })
    .identifier(["caseId"])
    .authorization((allow) => [allow.publicApiKey().to(["create", "read", "update", "delete"])]),

  Tag: a
    .model({
      tagId: a.string().required(),
      label: a.string().required(),
    })
    .identifier(["tagId"])
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),

  CaseTag: a
    .model({
      caseId: a.string().required(),
      tagId: a.string().required(),
    })
    .identifier(["caseId", "tagId"])
    .secondaryIndexes((index) => [index("tagId").sortKeys(["caseId"])])
    .authorization((allow) => [allow.publicApiKey().to(["read"])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: cases } = await client.models.Case.list()

// return <ul>{cases.map(item => <li key={item.caseId}>{item.caseName}</li>)}</ul>
