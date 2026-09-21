// Production. Replace the placeholder config with the real web config during the
// production rollout (see plan.md, section 7). Public web config is safe to commit.
export const environment = {
  useEmulators: false,
  firebase: {
    apiKey: 'REPLACE_ME',
    authDomain: 'somniation-dev.firebaseapp.com',
    projectId: 'somniation-dev',
    storageBucket: 'somniation-dev.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
  },
};
