import { z } from 'zod'
export const teamMemberSchema=z.object({name:z.string().min(2).max(80),designation:z.enum(['faculty_advisor','mentor','coordinator','co_coordinator','team_head','team_member']),teamId:z.string().max(50).optional(),termId:z.string().min(1).max(20),bio:z.string().max(800).optional(),socialLink:z.string().url().optional().or(z.literal('')),order:z.coerce.number().optional(),active:z.boolean().optional(),coCoordinatorOf:z.array(z.string()).optional(),photoUrl:z.string().url().optional().or(z.literal('')),photoPath:z.string().max(300).optional()})
export const teamSchema=z.object({name:z.string().min(2).max(60),slug:z.string().min(2).max(50),responsibility:z.string().min(5).max(500),order:z.number()})
export default teamMemberSchema
