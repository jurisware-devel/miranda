import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: {
      required: true,
    },
    name: {
      required: false,
    },
  },
  groups: ['Admin', 'User'],
});
