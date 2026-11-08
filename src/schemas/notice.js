import { z } from 'zod'
export const noticeSchema=z.object({title:z.string().min(2).max(140),body:z.string().min(5).max(4000),type:z.enum(['recruitment','event','workshop','competition','deadline','general']),important:z.boolean().optional(),pinned:z.boolean().optional(),deadline:z.string().optional(),published:z.boolean().optional()})
export default noticeSchema
