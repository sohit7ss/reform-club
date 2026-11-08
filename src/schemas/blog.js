import { z } from 'zod'
export const blogSchema=z.object({title:z.string().min(2).max(120),slug:z.string().min(2).max(120).regex(/^[a-z0-9-]+$/,'Slug uses lowercase letters, numbers and hyphens only'),category:z.enum(['tutorial','craft_idea','diy','tip','experience','process']),authorName:z.string().min(2).max(80),status:z.enum(['draft','pending','published']),content:z.string().min(5).max(20000),coverUrl:z.string().url().optional().or(z.literal('')),coverPath:z.string().max(300).optional()})
export default blogSchema
