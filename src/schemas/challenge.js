import { z } from 'zod'
export const challengeSchema=z.object({title:z.string().min(2).max(120),theme:z.string().min(2).max(120),description:z.string().min(5).max(4000),rules:z.string().max(4000).optional(),month:z.string().regex(/^\d{4}-\d{2}$/,'Use YYYY-MM'),semester:z.string().min(3).max(20),category:z.string().min(2).max(50),status:z.enum(['draft','open','voting','closed']),submissionDeadline:z.string().min(1),votingMode:z.enum(['public','judges','both'])})
export const submissionSchema=z.object({participantName:z.string().min(2).max(80),branch:z.string().min(2).max(80),academicYear:z.string().min(1).max(20),projectTitle:z.string().min(2).max(120),description:z.string().min(10).max(2000),howMade:z.string().min(10).max(2000),materialsUsed:z.string().min(2).max(1000)})
export const w2bSubmissionSchema=submissionSchema.extend({imageUrls:z.array(z.string().url()).min(1).max(5),imagePaths:z.array(z.string().max(300)).min(1).max(5)})
export default challengeSchema
