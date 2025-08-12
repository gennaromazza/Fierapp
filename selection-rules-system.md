# Sistema di Regole di Selezione Prodotti/Servizi

## Panoramica del Sistema

Sistema modulare per gestire regole condizionali di selezione prodotti e servizi con funzionalità di:
- **Disponibilità condizionale**: Prodotti che diventano non selezionabili in base alla selezione corrente
- **Trasformazione automatica in regalo**: Prodotti che diventano gratuiti quando vengono selezionati altri prodotti specifici

## Struttura Database Firebase

### Collezione: `selection_rules`
Contiene le regole di selezione configurabili dall'admin.

```javascript
// Documento esempio: rule_001
{
  id: "rule_001",
  name: "Regola Minimo 3 per Video Premium", 
  type: "availability", // "availability" | "gift_transformation"
  active: true,
  
  // Per regole di disponibilità
  conditions: {
    type: "min_selection_count", // "min_selection_count" | "specific_items" | "category_count"
    value: 3, // numero minimo di selezioni
    categories: ["servizio"], // categorie da considerare (opzionale)
    specificItems: [] // ID specifici (opzionale)
  },
  
  // Prodotti/servizi target della regola
  targetItems: ["video_premium_id"], // array di ID prodotti/servizi
  
  // Azione da eseguire
  action: "disable", // "disable" | "enable" | "make_gift"
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Documento esempio: rule_002  
{
  id: "rule_002",
  name: "Regalo Servizio Base con 2+ Premium",
  type: "gift_transformation",
  active: true,
  
  conditions: {
    type: "specific_items",
    requiredItems: ["premium_service_1", "premium_service_2"], // entrambi devono essere selezionati
    minimumCount: 2 // minimo 2 tra quelli specificati
  },
  
  targetItems: ["basic_service_id"],
  action: "make_gift",
  
  giftSettings: {
    showOriginalPrice: true, // mostra prezzo originale sbarrato
    giftText: "OMAGGIO!" // testo da mostrare
  },
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collezione: `items` (esistente)
Aggiunta dei campi per le regole:

```javascript
{
  // campi esistenti...
  id: "item_id",
  title: "Servizio Video Premium",
  price: 500,
  category: "servizio",
  
  // NUOVI CAMPI per regole
  ruleSettings: {
    canBeGift: true, // può diventare regalo
    canHaveConditions: true, // può avere condizioni di disponibilità
    priority: 1, // priorità per applicazione regole (1 = alta)
    tags: ["premium", "video"] // tag per regole avanzate
  }
}
```

## Piano di Programmazione

### Fase 1: Schema e Hook Base
1. **Aggiornare shared/schema.ts** con i nuovi tipi
2. **Creare useSelectionRules hook** per gestire le regole
3. **Estendere useCart hook** per integrare le regole

### Fase 2: Componente Principale
4. **Componente SelectionRulesEngine** - Motore principale delle regole
   - Input: carrello corrente, regole attive
   - Output: stato aggiornato prodotti (disponibili/disabilitati/regalo)
   - Logica di valutazione regole

### Fase 3: Integrazione UI
5. **Modificare ItemCard** per mostrare stati:
   - Prodotto disabilitato (grayed out)
   - Prodotto omaggio (prezzo sbarrato, badge "OMAGGIO")
   - Animazioni di transizione stato

### Fase 4: Admin Panel
6. **Componente RulesManagement** per configurare regole
   - CRUD regole di selezione
   - Preview in tempo reale
   - Test regole con carrelli simulati

### Fase 5: Integrazione Checkout
7. **Aggiornare CheckoutModal** per gestire omaggi
   - Mostrare prezzi originali e scontati
   - Riepilogo regole applicate

## Struttura File da Creare

```
client/src/
├── components/
│   ├── SelectionRulesEngine.tsx    # Componente principale motore regole
│   ├── ItemCardWithRules.tsx       # ItemCard esteso con supporto regole
│   └── admin/
│       └── RulesManagement.tsx     # Gestione regole admin
├── hooks/
│   ├── useSelectionRules.tsx       # Hook per gestire regole
│   └── useCartWithRules.tsx        # Estensione useCart con regole
└── lib/
    └── rulesEngine.ts              # Logica core valutazione regole

shared/
└── rulesSchema.ts                  # Schemi TypeScript per regole
```

## Query Database e Collezioni

### Query per Regole Attive
```javascript
// Hook useSelectionRules
const rulesQuery = query(
  collection(db, "selection_rules"),
  where("active", "==", true),
  orderBy("createdAt", "desc")
);
```

### Query per Items con Regole
```javascript
// Hook useItems esteso
const itemsQuery = query(
  collection(db, "items"),
  where("active", "==", true),
  orderBy("category", "asc"),
  orderBy("sortOrder", "asc")
);
```

### Aggiornamento Items per Regole
```javascript
// Aggiornare item per supportare regole
await updateDoc(doc(db, "items", itemId), {
  ruleSettings: {
    canBeGift: true,
    canHaveConditions: true,
    priority: 1,
    tags: ["premium", "video"]
  }
});
```

### CRUD Regole di Selezione
```javascript
// Creare nuova regola
await addDoc(collection(db, "selection_rules"), {
  name: "Nome Regola",
  type: "availability", 
  active: true,
  conditions: { /*...*/ },
  targetItems: ["item_id"],
  action: "disable",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
});

// Aggiornare regola esistente
await updateDoc(doc(db, "selection_rules", ruleId), {
  active: false,
  updatedAt: Timestamp.now()
});
```

## Logica Core del Motore

### Valutazione Regole di Disponibilità
1. **Input**: Carrello corrente, regole attive tipo "availability"
2. **Processo**: 
   - Per ogni regola attiva
   - Verifica condizioni (count, specific items, etc.)
   - Se condizioni soddisfatte → applica azione ai targetItems
3. **Output**: Lista item IDs da disabilitare/abilitare

### Valutazione Regole di Regalo
1. **Input**: Carrello corrente, regole attive tipo "gift_transformation"  
2. **Processo**:
   - Per ogni regola attiva
   - Verifica se requiredItems sono nel carrello
   - Se condizioni soddisfatte → marca targetItems come regalo
3. **Output**: Lista item IDs da trasformare in omaggio

### Priorità di Applicazione
1. **Regole di disponibilità** (priority ASC)
2. **Regole di regalo** (priority ASC)
3. **Conflict resolution**: Ultima regola applicata vince

## Test Cases da Implementare

### Scenario 1: Minimo 3 Selezioni
- Regola: Video Premium non selezionabile con meno di 3 servizi
- Test: Seleziona 2 servizi → Video Premium disabilitato
- Test: Seleziona 3 servizi → Video Premium abilitato

### Scenario 2: Regalo Condizionale  
- Regola: Servizio Base gratis con 2+ servizi Premium
- Test: Seleziona 1 Premium → Servizio Base prezzo normale
- Test: Seleziona 2+ Premium → Servizio Base diventa omaggio

### Scenario 3: Regole Multiple
- Test: Regole di disponibilità + regalo applicate insieme
- Test: Conflitti tra regole (gestione priorità)

## Note Tecniche

- **Performance**: Cache regole in React Query
- **Real-time**: Applicazione regole ad ogni cambio carrello  
- **Consistenza**: Validazione regole anche server-side nel checkout
- **UX**: Feedback visivo chiaro per ogni stato (normale/disabilitato/omaggio)
- **Modularity**: Componenti riutilizzabili e configurabili
- **Scalability**: Sistema estendibile per nuovi tipi di regole

## Naming Conventions

- **Collezioni**: `selection_rules`, `items` (esistente)
- **Componenti**: `SelectionRulesEngine`, `RulesManagement`  
- **Hooks**: `useSelectionRules`, `useCartWithRules`
- **Types**: `SelectionRule`, `RuleCondition`, `RuleAction`