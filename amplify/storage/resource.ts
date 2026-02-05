import { defineStorage } from '@aws-amplify/backend';

/**
 * Public (guest) read access to published decisions.
 * Uploads can be done via the AWS console/CLI for now.
 */
export const storage = defineStorage({
  name: 'decisions',
  access: (allow) => ({
    'decisions/*': [allow.guest.to(['read'])],
  }),
});
