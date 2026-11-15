const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Auth /user response, never an unverified browser-supplied identity. */
export function isGoogleIdentity(user:unknown):boolean {
  if(!record(user)||user.is_anonymous!==false)return false;
  const metadata=record(user.app_metadata)?user.app_metadata:{};
  return metadata.provider==='google'||Array.isArray(metadata.providers)&&metadata.providers.includes('google')
    ||Array.isArray(user.identities)&&user.identities.some(identity=>record(identity)&&identity.provider==='google');
}
