import { z } from 'zod'
import { SHARED_STORE_ENV } from './assumptions'

const credentialsSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  token: z.string().min(1),
})

export type SharedStoreCredentials = z.infer<typeof credentialsSchema>

export type Environment = Readonly<Record<string, string | undefined>>

const firstSet = (env: Environment, names: readonly string[]) => names.map((name) => env[name]).find(Boolean)

export function sharedStoreCredentials(env: Environment): SharedStoreCredentials | undefined {
  const { url, token } = SHARED_STORE_ENV.value
  const parsed = credentialsSchema.safeParse({ url: firstSet(env, url), token: firstSet(env, token) })
  return parsed.success ? parsed.data : undefined
}
