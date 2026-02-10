import { defineFunction } from '@aws-amplify/backend';

export const saveOpinion = defineFunction({
  name: 'saveOpinion',
  entry: './handler.ts',
  environment: {
    OPINIONS_BUCKET: 'opinions.jurisware.com',
    OPINIONS_PREFIX: 'texts/',
  },
});
