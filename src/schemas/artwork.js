import { z } from 'zod'
export const artworkSchema=z.object({title:z.string().min(2).max(100),artistName:z.string().min(2).max(80),category:z.enum(['painting','sketching','craft','waste_to_best']),description:z.string().max(1000).optional(),imageUrl:z.string().url().optional().or(z.literal('')),imagePath:z.string().max(300).optional()})
export default artworkSchema
