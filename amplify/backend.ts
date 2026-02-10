import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { saveOpinion } from './functions/save-opinion/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  saveOpinion,
});

backend.saveOpinion.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:PutObject'],
    resources: ['arn:aws:s3:::opinions.jurisware.com/texts/*'],
  }),
);
