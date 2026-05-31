declare interface ObjectConstructor {
  keys<T extends object>(o: T): (keyof T)[]
}

declare interface ImportMetaEnv {
  // 'true' enables the share button + /api/shorten flow (Cloudflare only).
  // Unset/anything else disables it (e.g. the Vercel mirror).
  readonly VITE_SHARE_ENABLED?: string
}
