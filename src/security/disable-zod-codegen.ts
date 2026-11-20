import { z } from 'zod'

export function disableZodCodegen(): void {
  z.config({ jitless: true })
}
