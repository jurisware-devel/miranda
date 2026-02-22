import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      scopes: ['OPENID', 'EMAIL', 'PROFILE'],
      callbackUrls: [
        'http://localhost:5173/',
        'https://miranda.jurisware.com/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://miranda.jurisware.com/',
      ],
    },
  },
  userAttributes: {
    email: {
      required: true,
    },
  },
  groups: ['Admin', 'User'],
});
