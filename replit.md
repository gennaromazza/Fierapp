## Overview

This is a full-stack promotional application ("Promo Fiera") designed for trade shows. Its purpose is to help businesses showcase special offers and collect customer leads. It functions as a kiosk-ready PWA with offline capabilities, featuring a complete admin panel for managing products, discounts, and customer leads. The application aims to display promotional offers, collect customer information via dynamic forms, and manage the sales funnel through an intuitive admin interface.

## User Preferences

Preferred communication style: Simple, everyday language.
User preference: Dislikes flashing/pulsing animation effects - prefers clean, static design without distracting animations.

## Recent Changes

### Unified Discount System & Enhanced Marketing Messages (August 13, 2025 - 6:10 PM) - COMPLETED
- **Unified Pricing System**: Created comprehensive `unifiedPricing.ts` with consistent discount calculations across all components
- **Marketing Message Engine**: Intelligent marketing messages that adapt based on savings percentage with persuasive copy
- **PDF Calculation Fix**: Updated PDF generation to use unified pricing system ensuring accurate totals and breakdowns
- **Enhanced Visual Feedback**: Rich savings displays with gradient backgrounds, multiple discount types, and urgency messaging
- **Firebase Error Resolution**: Fixed timestamp handling and data structure issues in lead form submission
- **Admin Panel Enhancement**: Added "Clear All Leads" functionality with double confirmation for data cleanup

### Full System Pricing Alignment Complete (August 19, 2025 - 1:25 PM) - COMPLETED
- **PDF System Update**: Updated PDF generation to use database-driven pricing structure matching CheckoutModal exactly
- **Gift Items in PDF**: PDF shows crossed-out original prices with green "GRATIS" text for gift items, identical to CheckoutModal display
- **WhatsApp Message Integration**: Updated WhatsApp message generation to use new pricing structure with detailed savings breakdown
- **LeadsManagement Email System**: Updated admin email generation to use new detailed pricing structure with gift item handling
- **Admin Dashboard Statistics**: Updated stats calculations to use totalSavings instead of legacy discount field
- **Unified Pricing Display**: All outputs (CheckoutModal, PDF, WhatsApp, Admin Emails, Dashboard) now show identical pricing information:
  - Subtotale servizi/prodotti (only paid items)
  - Sconti per prodotto/servizio (individual database discounts)
  - Sconto globale (-10%) (applied to subtotal after individual discounts)
  - Servizi in omaggio (gift item values)
  - TOTALE (final amount to pay)
  - Total savings summary
- **Complete System Consistency**: Perfect alignment across all system outputs - user interface, PDF downloads, WhatsApp messages, admin emails, and dashboard statistics
- **Database-Driven Logic**: All pricing calculations based on real originalPrice and price fields from Firebase database

### Sequential Discount Logic Implementation (August 19, 2025 - 11:22 AM) - COMPLETED
- **CRITICAL FIX**: Implemented sequential discount application - individual discounts now applied before global discounts
- **Pricing Logic Correction**: Fixed CheckoutModal pricing to show €540 instead of €630 by applying discounts sequentially (700€ → 600€ → 540€)
- **Enhanced getItemDiscountInfo**: Updated function to calculate individualSavings and globalSavings separately for accurate sequential processing
- **Unified Pricing System Update**: Modified calculateUnifiedPricing to use sequential discount calculations from enhanced discount info
- **Comprehensive Testing**: Created verification scripts confirming correct sequential logic: individual discount first, then global discount on reduced price
- **User Requirement Met**: Sequential discount logic now matches chat system pricing exactly in CheckoutModal

### Individual Product Discounts & Backend Chat Integration (August 13, 2025 - 2:13 PM) - COMPLETED
- **Individual Item Discount Support**: Enhanced discount system to handle both global and per-item discounts with priority logic
- **Comprehensive Savings Summary**: Added detailed savings breakdown showing global discounts, individual item discounts, and gift savings separately
- **Enhanced Discount Calculations**: `calculateCartSavings` and `getItemDiscountInfo` functions provide detailed discount analysis
- **Backend Data Integration**: Chat now personalizes messages using studio name, contact info, and discount details from Firebase settings
- **Smart Discount Display**: Products show individual vs global discounts with "(Special)" badge for item-specific offers
- **Studio-Personalized Experience**: Welcome messages, summaries, and interactions now use studio name and contact information

### Enhanced Rules Engine Integration (August 13, 2025 - 10:12 AM) - COMPLETED  
- **Intelligent Database Information Retrieval**: Integrated comprehensive rules engine with conversational flow for better user feedback
- **Smart Product Availability Messaging**: Chat now dynamically shows available products count, unlock conditions, and requirements based on selection rules
- **Gift Detection & Notification**: Automatic detection and celebration of unlocked gifts with dedicated messaging system
- **Enhanced Price Display**: Shows gift badges, original prices crossed out, and custom gift text from rule settings
- **Improved Error Handling**: Clear feedback when products are unavailable with specific requirement messages
- **Real-time Rules Evaluation**: Uses `useCartWithRules` hook for live evaluation of availability and gift transformation rules

### In-Chat Product Selection Integration (August 13, 2025 - 9:54 AM) - COMPLETED
- **Products/Services Inside Chat**: Fixed issue where selection was appearing below chat - now integrated directly inside chat messages
- **ChatProductSelector Component**: Renders product/service cards as part of the conversation flow
- **Seamless Experience**: Users can select items without leaving the chat conversation context
- **Clean Architecture**: Removed duplicate selector rendering that was outside the message bubble

### Firebase Database Standardization Complete (August 18, 2025 - 1:00 PM) - COMPLETED
- **React Key Warnings Resolved**: Removed all hardcoded message IDs causing duplicate key warnings
- **LSP Errors Fixed**: Resolved all 14 TypeScript errors in LeadsManagement with proper Firebase Timestamp handling
- **Firebase Field Standardization**: Eliminated all legacy uppercase field references (Nome, Cognome, Email, Telefono)
- **Unified Italian Lowercase Schema**: Standardized all customer fields to match Firebase database structure exactly
- **Customer Schema Typed**: Created proper Zod validation schema for customer fields with strong typing
- **Code Quality Achieved**: Zero LSP errors, zero console warnings, completely type-safe Firebase integration

## System Architecture

### Frontend Architecture
- **Vite + React + TypeScript** with mobile-first design.
- **ShadCN/UI + Tailwind CSS** for UI components and styling.
- **React Router (Wouter)** for routing.
- **TanStack React Query** for server state management.
- **React Hook Form + Zod** for form validation.
- **PWA-ready** with offline capabilities via Workbox.

### Backend Architecture
- **Express.js server** with TypeScript for API endpoints.
- **In-memory storage** with interface for easy database switching.
- **Vite middleware integration** for development hot reload.

### Data Storage Solutions
- **Primary Database**: Firebase Firestore for real-time data (items, leads, settings).
- **Secondary Storage**: Firebase Storage for image uploads and assets.
- **Local Storage**: For cart persistence and offline data caching.

### Authentication and Authorization
- **Firebase Authentication** for admin panel access (email/password).
- **Protected routes** with role-based access control.

### Key Features Architecture
- **Dynamic Form Builder**: Admin-configurable form fields with validation.
- **Real-time Cart System**: Persistent shopping cart with discount calculations.
- **Discount Engine**: Flexible percentage/fixed discounts with date ranges.
- **Lead Management**: CRM-like interface for customer tracking.
- **Export System**: Excel/CSV export for leads and items.
- **WhatsApp Integration**: Direct messaging for customer communication.
- **PDF Generation**: Quote/invoice generation.
- **Dynamic Brand Theming**: Real-time CSS variable-based theming from Firebase settings.
- **Modular Selection Rules Engine**: Configurable product/service availability and gift transformation rules with real-time evaluation.
- **Conversational Guide**: Full-screen conversational guide with mobile optimization, multi-avatar system, and integration of product selection within chat messages.
- **Session Isolation**: Guarantees a clean, empty cart on every page load for kiosk use.

### Design Principles
- **Modern Aesthetic**: Focus on solid colors, eliminating gradients.
- **Typography**: Playfair Display for headers, Inter for body text.
- **Visual Effects**: Glassmorphism effects with solid color support, enhanced shadows.
- **Animations**: Subtle, non-distracting animations like float, hover-lift, and fade-in.

## External Dependencies

### Firebase Services
- **Firebase App**: Core SDK.
- **Firestore Database**: Real-time NoSQL database.
- **Firebase Authentication**: User authentication.
- **Firebase Storage**: File uploads and assets.
- **Firebase Analytics**: User behavior tracking.

### UI and Styling
- **ShadCN/UI Components**: Pre-built accessible UI components.
- **Radix UI Primitives**: Low-level UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Form and Data Management
- **React Hook Form**: Form library.
- **Zod**: TypeScript-first schema validation.
- **TanStack React Query**: Server state synchronization and caching.

### Export and Communication
- **SheetJS (xlsx)**: Excel file generation.
- **jsPDF**: Client-side PDF generation.
- **WhatsApp Web API**: Direct messaging integration.
- **Date-fns**: Date manipulation and formatting.