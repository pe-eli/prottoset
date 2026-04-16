import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres').max(128),
  name: z.string()
    .min(2, 'O nome deve ter pelo menos 2 caracteres')
    .max(100)
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .refine((v) => v.split(' ').length >= 2, 'Informe nome e sobrenome.'),
  acceptedTerms: z.literal(true, { error: 'É necessário aceitar os termos para criar conta.' }),
});

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
});

export const verifyCodeSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
  verificationId: z.string().uuid('Identificador de verificação inválido.'),
  code: z.string().regex(/^\d{6}$/, 'Código inválido. Informe 6 dígitos.'),
});

export const checkEmailSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
});
