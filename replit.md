# replit.md

## Overview

This is a **full-stack promotional app** designed for trade shows ("Promo Fiera") that helps businesses showcase special offers and collect customer leads. The application combines a **React frontend** with an **Express.js backend**, using **Firebase as the primary database** for real-time data management. The app is designed as a kiosk-ready PWA with offline capabilities and features a complete admin panel for managing products, discounts, and customer leads.

The system enables businesses to display special promotional offers at trade shows, collect customer information through dynamic forms, and manage the entire sales funnel through a comprehensive admin interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Vite + React + TypeScript** application with mobile-first design
- **ShadCN/UI + Tailwind CSS** for component library and styling
- **React Router (Wouter)** with basename="/fiera" for subdirectory deployment
- **TanStack React Query** for server state management
- **React Hook Form + Zod** for form validation and schema management
- **PWA-ready** with offline capabilities via Workbox

### Backend Architecture
- **Express.js server** with TypeScript for API endpoints
- **In-memory storage** with interface for easy database switching
- **Vite middleware integration** for development hot reload
- **Session-based architecture** prepared for authentication

### Data Storage Solutions
- **Primary Database**: Firebase Firestore for real-time data synchronization
  - Items/products collection with categories (servizio/prodotto)
  - Leads collection for customer data and form submissions
  - Settings collections for app configuration and discounts
- **Secondary Storage**: Firebase Storage for image uploads and assets
- **Local Storage**: Cart persistence and offline data caching

### Authentication and Authorization
- **Firebase Authentication** for admin panel access
- **Email/password authentication** for admin users
- **Protected routes** with role-based access control
- **Session persistence** across browser refreshes

### Key Features Architecture
- **Dynamic Form Builder**: Admin-configurable form fields with validation
- **Real-time Cart System**: Persistent shopping cart with discount calculations
- **Discount Engine**: Flexible percentage/fixed discounts with date ranges
- **Lead Management**: Complete CRM-like interface for customer tracking
- **Export System**: Excel/CSV export capabilities for leads and items
- **WhatsApp Integration**: Direct messaging for customer communication
- **PDF Generation**: Quote/invoice generation with jsPDF

## External Dependencies

### Firebase Services
- **Firebase App**: Core Firebase SDK initialization
- **Firestore Database**: Real-time NoSQL database for all application data
- **Firebase Authentication**: User authentication and session management
- **Firebase Storage**: File uploads and static asset storage
- **Firebase Analytics**: User behavior tracking and metrics

### UI and Styling
- **ShadCN/UI Components**: Pre-built accessible UI component library
- **Radix UI Primitives**: Low-level UI primitives for complex components
- **Tailwind CSS**: Utility-first CSS framework with custom brand theming
- **Lucide React**: Icon library for consistent iconography

### Form and Data Management
- **React Hook Form**: Performance-focused form library
- **Zod**: TypeScript-first schema validation
- **TanStack React Query**: Server state synchronization and caching

### Export and Communication
- **SheetJS (xlsx)**: Excel file generation and CSV export
- **jsPDF**: Client-side PDF generation for quotes
- **WhatsApp Web API**: Direct messaging integration
- **Date-fns**: Date manipulation and formatting utilities

### Development Tools
- **Drizzle ORM**: Database schema management (PostgreSQL dialect configured)
- **TypeScript**: Type safety across the entire stack
- **Vite**: Build tool and development server
- **ESBuild**: Fast JavaScript bundler for production builds