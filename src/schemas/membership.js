import { z } from 'zod'
export const membershipSchema=z.object({fullName:z.string().min(2).max(80),branch:z.string().min(2).max(80),academicYear:z.string().min(1).max(20),email:z.string().email(),phone:z.string().regex(/^[+0-9][0-9 -]{7,14}$/,'Enter a valid phone number'),interests:z.array(z.string()).min(1,'Pick at least one interest'),skills:z.string().max(500).optional(),portfolioLink:z.string().url().optional().or(z.literal('')),intro:z.string().min(10).max(1000),honeypot:z.string().max(0).optional()})
export default membershipSchema
