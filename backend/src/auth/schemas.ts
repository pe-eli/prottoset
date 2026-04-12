import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres').max(128),
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres').max(100).transform((v) => v.trim()),
  captchaToken: z.string().min(1, 'Captcha é obrigatório').max(2048),
});

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido').max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});
