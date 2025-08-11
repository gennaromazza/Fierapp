import { type Item, type InsertItem, type Lead, type InsertLead, type Settings, type Discounts } from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface for Firebase collections
export interface IStorage {
  // Items (Products/Services)
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, item: Partial<InsertItem>): Promise<Item>;
  deleteItem(id: string): Promise<void>;

  // Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;

  // Settings
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;

  // Discounts
  getDiscounts(): Promise<Discounts | undefined>;
  updateDiscounts(discounts: Discounts): Promise<Discounts>;
}

export class MemStorage implements IStorage {
  private items: Map<string, Item>;
  private leads: Map<string, Lead>;
  private settings: Settings | undefined;
  private discounts: Discounts | undefined;

  constructor() {
    this.items = new Map();
    this.leads = new Map();
  }

  async getItems(): Promise<Item[]> {
    return Array.from(this.items.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getItem(id: string): Promise<Item | undefined> {
    return this.items.get(id);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const id = randomUUID();
    const now = new Date();
    const item: Item = { ...insertItem, id, createdAt: now, updatedAt: now };
    this.items.set(id, item);
    return item;
  }

  async updateItem(id: string, updates: Partial<InsertItem>): Promise<Item> {
    const existing = this.items.get(id);
    if (!existing) throw new Error("Item not found");
    
    const updated: Item = { ...existing, ...updates, updatedAt: new Date() };
    this.items.set(id, updated);
    return updated;
  }

  async deleteItem(id: string): Promise<void> {
    this.items.delete(id);
  }

  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = { ...insertLead, id, createdAt: new Date() };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const existing = this.leads.get(id);
    if (!existing) throw new Error("Lead not found");
    
    const updated: Lead = { ...existing, ...updates };
    this.leads.set(id, updated);
    return updated;
  }

  async getSettings(): Promise<Settings | undefined> {
    return this.settings;
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...updates } as Settings;
    return this.settings;
  }

  async getDiscounts(): Promise<Discounts | undefined> {
    return this.discounts;
  }

  async updateDiscounts(discounts: Discounts): Promise<Discounts> {
    this.discounts = discounts;
    return discounts;
  }
}

export const storage = new MemStorage();
