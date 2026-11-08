import { z } from 'zod'
export const constitutionSchema=z.object({version:z.string().min(1).max(20),title:z.string().min(2).max(140),notes:z.string().max(2000).optional(),fileUrl:z.string().url().optional().or(z.literal('')),filePath:z.string().max(300).optional(),isLatest:z.boolean().optional(),uploadedBy:z.string().max(80).optional()})
export default constitutionSchema
