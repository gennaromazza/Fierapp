import { z } from "zod";

// Items (Products/Services) Schema
export const itemSchema = z.object({
  id: z.string(),
  title: z.string().max(40),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  price: z.number().min(0),
  originalPrice: z.number().min(0).optional(),
  imageUrl: z.string().optional(),
  active: z.boolean().default(true),
  category: z.enum(["prodotto", "servizio"]),
  sortOrder: z.number().default(0),
  ruleSettings: z.object({
    canBeGift: z.boolean().default(true),
    canHaveConditions: z.boolean().default(true),
    priority: z.number().default(1),
    tags: z.array(z.string()).default([]),
  }).optional(),
  mutuallyExclusiveWith: z.array(z.string()).optional(), // IDs degli item mutualmente esclusivi
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertItemSchema = itemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Item = z.infer<typeof itemSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;

// Discount Schema
export const discountSchema = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.number().min(0),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  isActive: z.boolean().default(true),
});

export const discountsSchema = z.object({
  global: discountSchema.optional(),
  perItemOverrides: z.record(z.string(), discountSchema).optional(),
});

export type Discount = z.infer<typeof discountSchema>;
export type Discounts = z.infer<typeof discountsSchema>;

// Settings Schema
export const formFieldSchema = z.object({
  type: z.enum(["text", "email", "tel", "date", "textarea", "select"]),
  label: z.string(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const settingsSchema = z.object({
  studioName: z.string(),
  logoUrl: z.string().optional(),
  heroTitle: z.string().default("OFFERTE SPECIALI FIERA"),
  heroSubtitle: z.string().default("Scopri i nostri pacchetti esclusivi con sconti fino al 30%"),
  brandPrimary: z.string().default("#F1EFEC"),
  brandSecondary: z.string().default("#D4C9BE"),
  brandAccent: z.string().default("#123458"),
  // Advanced color controls
  brandTextPrimary: z.string().default("#1a1a1a"), // Main text color
  brandTextSecondary: z.string().default("#6b7280"), // Secondary text color
  brandTextAccent: z.string().default("#123458"), // Accent text color
  brandBackground: z.string().default("#ffffff"), // Main background
  brandSurface: z.string().default("#f8fafc"), // Card/surface color
  brandBorder: z.string().default("#e2e8f0"), // Border color
  whatsappNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
  studioAddress: z.string().optional(),
  studioCoordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  socialMedia: z.object({
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    youtube: z.string().url().optional(),
    twitter: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    tiktok: z.string().url().optional(),
  }).optional(),
  businessHours: z.object({
    enabled: z.boolean().default(true),
    weekdays: z.object({
      enabled: z.boolean().default(true),
      open: z.string().default("9:00"),
      close: z.string().default("18:00"),
      label: z.string().default("Lun-Ven")
    }),
    saturday: z.object({
      enabled: z.boolean().default(true),
      open: z.string().default("9:00"),
      close: z.string().default("13:00"),
      label: z.string().default("Sab")
    }),
    sunday: z.object({
      enabled: z.boolean().default(false),
      open: z.string().default("10:00"),
      close: z.string().default("12:00"),
      label: z.string().default("Dom")
    })
  }).optional(),
  formFields: z.array(formFieldSchema).default([
    { type: "text", label: "Nome", required: true },
    { type: "text", label: "Cognome", required: true },
    { type: "email", label: "Email", required: true },
    { type: "tel", label: "Telefono", required: true },
    { type: "date", label: "Data evento", required: true },
    { type: "textarea", label: "Note aggiuntive", required: false },
  ]),
  gdprText: z.string().default("Acconsento al trattamento dei miei dati personali secondo la Privacy Policy."),
  reCAPTCHASiteKey: z.string().optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;
export type Settings = z.infer<typeof settingsSchema>;

// Lead Schema
export const leadSchema = z.object({
  id: z.string(),
  customer: z.record(z.string(), z.any()).optional(), // Legacy format
  // New conversational guide format - add direct properties
  name: z.string().optional(),
  surname: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  eventDate: z.string().optional(),
  notes: z.string().optional(),
  gdprAccepted: z.boolean().optional(),
  selectedItems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    price: z.number(),
    originalPrice: z.number().optional(),
  })).optional(), // Legacy format
  cart: z.any().optional(), // New format cart data
  pricing: z.object({
    subtotal: z.number(),
    discount: z.number(),
    total: z.number(),
    giftSavings: z.number().optional(),
    totalSavings: z.number().optional(),
  }).optional(),
  gdprConsent: z.object({
    accepted: z.boolean(),
    text: z.string(),
    timestamp: z.date(),
  }).optional(),
  reCAPTCHAToken: z.string().optional(),
  createdAt: z.date(),
  source: z.string().optional(), // Track where lead came from
  status: z.enum(["new", "contacted", "email_sent", "quoted", "closed"]).default("new"),
});

export const insertLeadSchema = leadSchema.omit({
  id: true,
  createdAt: true,
});

export type Lead = z.infer<typeof leadSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// Audit Log Schema
export const auditLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  changes: z.record(z.string(), z.any()).optional(),
  timestamp: z.date(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

// Cart Item Schema
export const cartItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  imageUrl: z.string().optional(),
  category: z.enum(["prodotto", "servizio"]),
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Cart Schema
export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  itemCount: z.number(),
});

export type Cart = z.infer<typeof cartSchema>;