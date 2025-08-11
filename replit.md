# replit.md

## Overview

This is a **full-stack promotional app** designed for trade shows ("Promo Fiera") that helps businesses showcase special offers and collect customer leads. The application combines a **React frontend** with an **Express.js backend**, using **Firebase as the primary database** for real-time data management. The app is designed as a kiosk-ready PWA with offline capabilities and features a complete admin panel for managing products, discounts, and customer leads.

The system enables businesses to display special promotional offers at trade shows, collect customer information through dynamic forms, and manage the entire sales funnel through a comprehensive admin interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 10, 2025)

### Dynamic Brand Theming System Implementation
- **CSS Variables**: Implemented comprehensive CSS custom properties for brand colors (--brand-primary, --brand-secondary, --brand-accent)
- **Real-time Updates**: Brand colors from Firebase admin settings apply instantly across the entire application
- **useBrandColors Hook**: Created custom React hook that listens to Firebase and updates CSS variables in real-time
- **Enhanced Color Functions**: Added HSL conversion, color lightening/darkening, and contrast detection for automatic text color adjustment
- **Component Integration**: Updated all major components (Header, ItemCard, Carousel) to use dynamic CSS variables instead of fixed Tailwind classes
- **Admin Panel Theming**: Extended dynamic theming to admin panels - all tables, cards, buttons, inputs and UI elements now use brand colors
- **Admin Preview**: Added live color preview in admin settings panel to show changes before saving
- **Tailwind Integration**: Modified Tailwind config to support CSS variable-based theming while maintaining utility class support
- **Complete UI Theming**: Applied brand colors to:
  - Admin panels (tabs, cards, headers, buttons)
  - Tables (headers, hover states)
  - Form elements (focus states, inputs, selects)
  - Badges, switches, checkboxes
  - Dialogs and modals

### Modern Aesthetic Design Improvements
- **Typography Enhancement**: Added Playfair Display serif font for headers and Inter variable font weights (300-900) for better hierarchy
- **Glassmorphism Effects**: Implemented glass and glass-dark classes with backdrop-filter blur for modern translucent UI elements
- **Gradient Backgrounds**: Created gradient-primary, gradient-accent, and gradient-radial classes for dynamic background effects
- **Enhanced Shadows**: Added shadow-elegant and shadow-glow classes for depth and visual interest
- **Premium Card Styles**: Developed card-premium class with sophisticated layered shadows and glassmorphism
- **Advanced Animations**: 
  - Float animation for subtle element movement
  - Pulse-shadow for attention-grabbing CTAs
  - Hover-lift for interactive card elevation
  - Fade-in for smooth content appearance
- **Button Improvements**: Premium button styles with gradient backgrounds, hover shine effects, and scale transformations
- **Modern Components**: Updated Header, ItemCard, PriceBar, and Carousel with new aesthetic classes
- **Interactive Elements**: All buttons and cards now have smooth scale and shadow transitions on hover
- **Custom Scrollbar**: Styled scrollbar with brand colors and smooth rounded edges
- **Hero Section Enhancement**: Upgraded with animated decorative elements and improved typography

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
- **Dynamic Brand Theming**: Real-time CSS variable-based theming system that applies brand colors from Firebase settings to all UI components

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