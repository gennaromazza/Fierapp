// Utility per cancellare tutti i lead dal database Firebase
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export async function clearAllLeads(): Promise<void> {
  try {
    console.log('🗑️ Cancellando tutti i lead dal database...');
    
    // Ottieni tutti i documenti dalla collezione leads
    const leadsCollection = collection(db, 'leads');
    const snapshot = await getDocs(leadsCollection);
    
    console.log(`📊 Trovati ${snapshot.size} lead da cancellare`);
    
    if (snapshot.size === 0) {
      console.log('✅ Nessun lead da cancellare - database già pulito!');
      return;
    }
    
    // Cancella ogni documento
    const deletePromises = snapshot.docs.map(leadDoc => 
      deleteDoc(doc(db, 'leads', leadDoc.id))
    );
    
    await Promise.all(deletePromises);
    
    console.log('✅ Tutti i lead sono stati cancellati con successo!');
    console.log('🔄 Ora l\'admin panel dovrebbe funzionare senza errori.');
    
  } catch (error) {
    console.error('❌ Errore durante la cancellazione dei lead:', error);
    throw error;
  }
}