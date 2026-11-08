import { z } from 'zod'
export const commentSchema=z.object({artworkId:z.string().min(1),text:z.string().min(1).max(500)})
export default commentSchema
