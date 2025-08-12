rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Settings collection - read pubblico, write solo admin autenticati
    match /settings/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Items collection - read pubblico, write solo admin autenticati
    match /items/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Discounts collection - read pubblico, write solo admin autenticati
    match /discounts/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Leads collection - write sempre permesso (per form pubblici), read solo admin
    match /leads/{document} {
      allow read: if request.auth != null;
      allow write: if true;
    }
    
    // Selection rules collection - READ PUBBLICO (per frontend), write solo admin autenticati
    match /selection_rules/{document} {
      allow read: if true;  // ✅ MODIFICATO: lettura pubblica per frontend
      allow write: if request.auth != null;
    }
    
    // Counters collection - solo admin autenticati (in produzione)
    match /counters/{docId} {
      allow read, write: if request.auth != null;
    }
    
    // Admin users collection - solo admin autenticati
    match /admin/{document} {
      allow read, write: if request.auth != null;
    }
  }
}