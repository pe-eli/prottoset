import { z } from 'zod';

const uuidSchema = z.string().uuid('Identificador inválido');
const isoDateSchema = z.string().datetime('Data inválida');
const isoDateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário inválido');
const weekSchema = z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/, 'Semana inválida');
const nonEmptyString = (max: number, message: string) => z.string().trim().min(1, message).max(max);

export const quoteSchema = z.object({
  id: uuidSchema,
  client: z.object({
    name: nonEmptyString(160, 'Nome do cliente é obrigatório'),
    company: z.string().trim().max(160).default(''),
    email: z.string().trim().email('E-mail inválido').max(255),
  }),
  project: z.object({
    name: nonEmptyString(160, 'Nome do projeto é obrigatório'),
    description: z.string().trim().max(5000).default(''),
  }),
  services: z.array(z.object({
    service: z.object({
      id: uuidSchema,
      name: nonEmptyString(160, 'Serviço inválido'),
      description: z.string().trim().max(2000).default(''),
      basePrice: z.number().finite().nonnegative(),
    }),
    quantity: z.number().int().positive().max(1000),
  })).max(200),
  extras: z.array(z.object({
    extra: z.object({
      id: uuidSchema,
      name: nonEmptyString(160, 'Extra inválido'),
      description: z.string().trim().max(2000).default(''),
      price: z.number().finite().nonnegative(),
    }),
  })).max(200),
  payment: z.object({
    method: z.enum(['pix', 'transferencia', 'parcelamento']),
    installments: z.number().int().positive().max(36).optional(),
  }),
  subtotalServices: z.number().finite().nonnegative(),
  subtotalExtras: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
  createdAt: isoDateSchema,
  validUntil: isoDateSchema,
});

export const packagesQuoteSchema = z.object({
  id: uuidSchema,
  clientName: nonEmptyString(160, 'Nome do cliente é obrigatório'),
  projectName: nonEmptyString(160, 'Nome do projeto é obrigatório'),
  projectDescription: z.string().trim().max(5000).default(''),
  referenceUrl: z.string().trim().url('URL de referência inválida').max(1000).optional().or(z.literal('')),
  plans: z.array(z.object({
    name: nonEmptyString(160, 'Nome do plano é obrigatório'),
    priceAVista: z.number().finite().nonnegative(),
    priceInstallments: z.number().finite().nonnegative().optional(),
    monthlyFee: z.number().finite().nonnegative().optional(),
    monthlyFeeDescription: z.string().trim().max(300).optional(),
    features: z.array(nonEmptyString(300, 'Feature inválida')).max(100),
    highlighted: z.boolean().optional(),
  })).min(1).max(50),
  deliveryDays: z.string().trim().max(60).default(''),
  paymentTerms: z.string().trim().max(500).default(''),
  paymentMethod: z.string().trim().max(100).default(''),
  paymentMethods: z.array(z.string().trim().max(100)).max(20),
  installments: z.number().int().nonnegative().max(36),
  validityDays: z.number().int().nonnegative().max(365),
  createdAt: isoDateSchema,
});

export const contactCreateSchema = z.object({
  emails: z.array(z.string().trim().email('E-mail inválido').max(255)).min(1).max(1000),
});

export const contactUpdateSchema = z.object({
  name: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(160).optional(),
  status: z.enum(['new', 'contacted', 'negotiating', 'client', 'lost']).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const emailBlastSchema = z.object({
  emails: z.array(z.string().trim().email('E-mail inválido').max(255)).min(1).max(1000),
  subject: nonEmptyString(200, 'Assunto é obrigatório'),
  body: nonEmptyString(10000, 'Corpo do email é obrigatório'),
  batchSize: z.coerce.number().int().positive().max(50).optional(),
  intervalMinSeconds: z.coerce.number().int().min(5).max(3600).optional(),
  intervalMaxSeconds: z.coerce.number().int().min(5).max(3600).optional(),
});

export const whatsappBlastSchema = z.object({
  phones: z.array(z.union([z.string(), z.number()]).transform((value) => String(value))).min(1).max(1000),
  batchSize: z.coerce.number().int().positive().max(50).optional(),
  intervalMinSeconds: z.coerce.number().int().min(5).max(3600).optional(),
  intervalMaxSeconds: z.coerce.number().int().min(5).max(3600).optional(),
  promptBase: z.string().trim().max(1000).optional(),
});

export const uuidParamSchema = z.object({
  id: uuidSchema,
});

export const blastParamSchema = z.object({
  blastId: uuidSchema,
});

export const weekParamSchema = z.object({
  week: weekSchema,
});

const recurrenceSchema = z.object({
  type: z.literal('weekly'),
  dayOfWeek: z.number().int().min(0).max(6),
});

export const scheduleCreateSchema = z.object({
  title: nonEmptyString(160, 'Título é obrigatório'),
  category: z.enum(['prottocode', 'alura', 'dimouras']),
  startTime: timeSchema,
  endTime: timeSchema,
  date: isoDateOnlySchema.optional(),
  recurrence: recurrenceSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.date && !value.recurrence) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe date (evento único) ou recurrence (recorrente)',
      path: ['date'],
    });
  }
});

export const scheduleUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(['prottocode', 'alura', 'dimouras']).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  date: isoDateOnlySchema.optional().nullable(),
  recurrence: recurrenceSchema.optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Nenhum campo para atualizar foi informado',
});

export const productivityCreateSchema = z.object({
  date: isoDateOnlySchema,
  prottocodeHours: z.number().finite().min(0).max(24),
  aluraHours: z.number().finite().min(0).max(24).default(0),
  dimourasHours: z.number().finite().min(0).max(24).default(0),
  focus: z.string().trim().max(500).default(''),
  completion: z.number().int().min(0).max(100).default(0),
  notes: z.string().trim().max(5000).default(''),
  rating: z.enum(['excellent', 'good', 'average', 'bad']).default('average'),
});

export const productivityUpdateSchema = z.object({
  date: isoDateOnlySchema.optional(),
  prottocodeHours: z.number().finite().min(0).max(24).optional(),
  aluraHours: z.number().finite().min(0).max(24).optional(),
  dimourasHours: z.number().finite().min(0).max(24).optional(),
  focus: z.string().trim().max(500).optional(),
  completion: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(5000).optional(),
  rating: z.enum(['excellent', 'good', 'average', 'bad']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Nenhum campo para atualizar foi informado',
});

export const queueCreateSchema = z.object({
  name: nonEmptyString(120, 'Nome da fila é obrigatório'),
});

export const queueRenameSchema = z.object({
  name: nonEmptyString(120, 'Nome é obrigatório'),
});

export const queuePhonesSchema = z.object({
  phones: z.array(z.union([z.string(), z.number()]).transform((value) => String(value).trim())).min(1, 'Lista de telefones é obrigatória').max(1000),
});

export const queueMergeSchema = z.object({
  sourceIds: z.array(uuidSchema).min(2, 'Selecione pelo menos 2 filas para juntar').max(100),
  name: nonEmptyString(120, 'Nome da fila resultante é obrigatório'),
});

export const queuePhoneParamSchema = z.object({
  id: uuidSchema,
  phone: z.string().trim().min(1, 'Telefone inválido').max(40),
});

export const leadFolderCreateSchema = z.object({
  name: nonEmptyString(120, 'Nome da pasta é obrigatório'),
});

export const leadFolderLeadsSchema = z.object({
  leadIds: z.array(uuidSchema).min(1, 'Lista de leads é obrigatória').max(1000),
});

export const leadSearchSchema = z.object({
  searchTerm: nonEmptyString(160, 'searchTerm é obrigatório'),
  city: nonEmptyString(160, 'city é obrigatório'),
  maxResults: z.coerce.number().int().min(1).max(100).optional(),
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'replied', 'converted', 'ignored']),
});

export const captchaTokenSchema = z.object({
  captchaToken: nonEmptyString(2048, 'Captcha é obrigatório'),
});