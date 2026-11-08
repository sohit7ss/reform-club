import { z } from 'zod'
export const legacySchema=z.object({year:z.string().regex(/^\d{4}$/,'Year must be four digits'),title:z.string().min(2).max(120),description:z.string().min(5).max(2000),kind:z.enum(['event','achievement','milestone','person']),order:z.coerce.number().optional()})
export default legacySchema
