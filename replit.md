## Overview

This is a full-stack promotional application ("Promo Fiera") designed for trade shows. Its purpose is to help businesses showcase special offers and collect customer leads. It functions as a kiosk-ready PWA with offline capabilities, featuring a complete admin panel for managing products, discounts, and customer leads. The application aims to display promotional offers, collect customer information via dynamic forms, and manage the sales funnel through an intuitive admin interface.

## User Preferences

Preferred communication style: Simple, everyday language.
User preference: Dislikes flashing/pulsing animation effects - prefers clean, static design without distracting animations.

## Recent Changes

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