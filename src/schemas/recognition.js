import { z } from 'zod'
export const recognitionSchema=z.object({type:z.enum(['artist_of_month','artist_of_semester','hall_of_fame']),artistName:z.string().min(2).max(80),period:z.string().min(2).max(40),citation:z.string().min(5).max(1000),photoUrl:z.string().url().optional().or(z.literal('')),photoPath:z.string().max(300).optional()})
export default recognitionSchema
