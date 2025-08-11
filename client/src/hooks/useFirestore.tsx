import { useState, useEffect } from "react";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  DocumentSnapshot,
  QuerySnapshot,
  FirestoreError,
} from "firebase/firestore";
import { db } from "../firebase";

export function useDocument<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const docRef = doc(db, path);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (error: FirestoreError) => {
        setError(error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [path]);

  return { data, loading, error };
}

export function useCollection<T>(
  collectionPath: string,
  queryConstraints: any[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const collectionRef = collection(db, collectionPath);
    const q = queryConstraints.length > 0 
      ? query(collectionRef, ...queryConstraints)
      : query(collectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot) => {
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as T[];
        
        setData(documents);
        setLoading(false);
      },
      (error: FirestoreError) => {
        setError(error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionPath, JSON.stringify(queryConstraints)]);

  return { data, loading, error };
}
