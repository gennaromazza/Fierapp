// Script per cancellare tutti i lead dal database Firebase
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './client/src/firebase.js';

async function clearAllLeads() {
  try {
    console.log('🗑️ Cancellando tutti i lead dal database...');
    
    // Ottieni tutti i documenti dalla collezione leads
    const leadsCollection = collection(db, 'leads');
    const snapshot = await getDocs(leadsCollection);
    
    console.log(`📊 Trovati ${snapshot.size} lead da cancellare`);
    
    // Cancella ogni documento
    const deletePromises = snapshot.docs.map(leadDoc => 
      deleteDoc(doc(db, 'leads', leadDoc.id))
    );
    
    await Promise.all(deletePromises);
    
    console.log('✅ Tutti i lead sono stati cancellati con successo!');
    console.log('🔄 Ora l\'admin panel dovrebbe funzionare senza errori.');
    
  } catch (error) {
    console.error('❌ Errore durante la cancellazione dei lead:', error);
  }
}

// Esegui la cancellazione
clearAllLeads();