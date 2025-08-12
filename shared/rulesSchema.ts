import { z } from "zod";

// Tipi di condizioni per le regole
export const ruleConditionSchema = z.object({
  type: z.enum(["min_selection_count", "specific_items", "category_count", "required_items", "mutually_exclusive"]),
  value: z.number().optional(), // per min_selection_count, category_count
  categories: z.array(z.string()).optional(), // per category_count
  specificItems: z.array(z.string()).optional(), // per specific_items
  requiredItems: z.array(z.string()).optional(), // per required_items (tutti devono essere presenti)
  minimumCount: z.number().optional(), // per required_items (minimo N tra quelli specificati)
  mutuallyExclusiveWith: z.array(z.string()).optional(), // per mutually_exclusive (item che si escludono a vicenda)
});

// Schema per le impostazioni regalo
export const giftSettingsSchema = z.object({
  showOriginalPrice: z.boolean().default(true),
  giftText: z.string().default("OMAGGIO!"),
  giftBadgeColor: z.string().default("#10b981"), // colore badge omaggio
});

// Schema principale regola di selezione
export const selectionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["availability", "gift_transformation"]),
  active: z.boolean().default(true),
  priority: z.number().default(1), // 1 = alta priorità
  
  // Condizioni per attivare la regola
  conditions: ruleConditionSchema,
  
  // Prodotti/servizi target della regola
  targetItems: z.array(z.string()),
  
  // Azione da eseguire
  action: z.enum(["disable", "enable", "make_gift"]),
  
  // Impostazioni specifiche per regole regalo
  giftSettings: giftSettingsSchema.optional(),
  
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Schema per inserire nuova regola (senza id e date auto-generate)
export const insertSelectionRuleSchema = selectionRuleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema per le impostazioni regole degli item
export const itemRuleSettingsSchema = z.object({
  canBeGift: z.boolean().default(true),
  canHaveConditions: z.boolean().default(true),
  priority: z.number().default(1),
  tags: z.array(z.string()).default([]),
});

// Tipi TypeScript
export type RuleCondition = z.infer<typeof ruleConditionSchema>;
export type GiftSettings = z.infer<typeof giftSettingsSchema>;
export type SelectionRule = z.infer<typeof selectionRuleSchema>;
export type InsertSelectionRule = z.infer<typeof insertSelectionRuleSchema>;
export type ItemRuleSettings = z.infer<typeof itemRuleSettingsSchema>;

// Stato applicato di un item dopo valutazione regole
export const itemStateSchema = z.object({
  itemId: z.string(),
  isAvailable: z.boolean().default(true),
  isGift: z.boolean().default(false),
  originalPrice: z.number().optional(),
  giftSettings: giftSettingsSchema.optional(),
  appliedRules: z.array(z.string()).default([]), // ID delle regole applicate
});

export type ItemState = z.infer<typeof itemStateSchema>;

// Risultato della valutazione regole
export const rulesEvaluationResultSchema = z.object({
  itemStates: z.record(z.string(), itemStateSchema), // itemId -> stato
  appliedRules: z.array(z.string()), // ID regole applicate
  conflicts: z.array(z.object({
    itemId: z.string(),
    conflictingRules: z.array(z.string()),
    resolution: z.string(),
  })).default([]),
});

export type RulesEvaluationResult = z.infer<typeof rulesEvaluationResultSchema>;