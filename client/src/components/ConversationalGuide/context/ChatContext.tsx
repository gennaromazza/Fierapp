import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Settings, Discounts } from '../../../firebase';

// Types
export type PhaseType = 
  | 'welcome' 
  | 'date_selection' 
  | 'collect_name'
  | 'collect_surname'
  | 'collect_email'
  | 'collect_phone'
  | 'collect_date'
  | 'services' 
  | 'products' 
  | 'checkout'
  | 'final';

export type MessageType = 'assistant' | 'user' | 'system';
export type AvatarType = 'explaining' | 'smiling' | 'enthusiastic' | 'excited' | 'love';

export interface ChatMessage {
  id?: string;
  type: MessageType;
  text: string;
  avatar?: AvatarType;
  options?: Array<{
    id: string;
    label: string;
    value: string;
    action?: () => void;
  }>;
  items?: any[];
  showCart?: boolean;
  typing?: boolean;
  component?: 'service-selector' | 'product-selector' | 'date-selector';
}

export interface LeadData {
  name: string;
  surname: string;
  email: string;
  phone: string;
  eventDate: string;
  notes?: string;
  gdprAccepted?: boolean;
}

export interface ConversationData {
  userName?: string;
  eventDate?: string;
  selectedServices: string[];
  selectedProducts: string[];
  preferences: string[];
  sessionId: string;
  startTime: Date;
  currentPhase: PhaseType;
  messagesCount: number;
  cartItemsCount: number;
  totalValue: number;
  totalSavings: number;
}

export interface ChatState {
  messages: ChatMessage[];
  currentPhase: PhaseType;
  leadData: LeadData;
  conversationData: ConversationData;
  isTyping: boolean;
  userInput: string;
  sessionStarted: boolean;
  messageCounter: number;
  settings: Settings | null;
  discounts: Discounts | null;
  itemsReady: boolean;
}

// Action Types
export type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_PHASE'; payload: PhaseType }
  | { type: 'UPDATE_LEAD_DATA'; payload: Partial<LeadData> }
  | { type: 'UPDATE_CONVERSATION_DATA'; payload: Partial<ConversationData> }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_USER_INPUT'; payload: string }
  | { type: 'SET_SESSION_STARTED'; payload: boolean }
  | { type: 'INCREMENT_MESSAGE_COUNTER' }
  | { type: 'SET_SETTINGS'; payload: Settings | null }
  | { type: 'SET_DISCOUNTS'; payload: Discounts | null }
  | { type: 'SET_ITEMS_READY'; payload: boolean }
  | { type: 'RESET_CHAT' }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] };

// Initial State
const initialLeadData: LeadData = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  eventDate: '',
  notes: '',
  gdprAccepted: false
};

const initialConversationData: ConversationData = {
  selectedServices: [],
  selectedProducts: [],
  preferences: [],
  sessionId: `session_${Date.now()}`,
  startTime: new Date(),
  currentPhase: 'welcome',
  messagesCount: 0,
  cartItemsCount: 0,
  totalValue: 0,
  totalSavings: 0
};

const initialState: ChatState = {
  messages: [],
  currentPhase: 'welcome',
  leadData: initialLeadData,
  conversationData: initialConversationData,
  isTyping: false,
  userInput: '',
  sessionStarted: false,
  messageCounter: 0,
  settings: null,
  discounts: null,
  itemsReady: false
};

// Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      const messageWithId = {
        ...action.payload,
        id: action.payload.id || `msg-${Date.now()}-${Math.random()}`
      };
      return {
        ...state,
        messages: [...state.messages, messageWithId],
        messageCounter: state.messageCounter + 1,
        conversationData: {
          ...state.conversationData,
          messagesCount: state.conversationData.messagesCount + 1
        }
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.payload
      };

    case 'SET_PHASE':
      return {
        ...state,
        currentPhase: action.payload,
        conversationData: {
          ...state.conversationData,
          currentPhase: action.payload
        }
      };

    case 'UPDATE_LEAD_DATA':
      const updatedLeadData = { ...state.leadData, ...action.payload };
      console.log('📝 ChatContext - Lead data updated:', updatedLeadData);
      return {
        ...state,
        leadData: updatedLeadData
      };

    case 'UPDATE_CONVERSATION_DATA':
      return {
        ...state,
        conversationData: { ...state.conversationData, ...action.payload }
      };

    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };

    case 'SET_USER_INPUT':
      return { ...state, userInput: action.payload };

    case 'SET_SESSION_STARTED':
      return { ...state, sessionStarted: action.payload };

    case 'INCREMENT_MESSAGE_COUNTER':
      return { ...state, messageCounter: state.messageCounter + 1 };

    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };

    case 'SET_DISCOUNTS':
      return { ...state, discounts: action.payload };

    case 'SET_ITEMS_READY':
      return { ...state, itemsReady: action.payload };

    case 'RESET_CHAT':
      return {
        ...initialState,
        settings: state.settings,
        discounts: state.discounts,
        conversationData: {
          ...initialConversationData,
          sessionId: `session_${Date.now()}`,
          startTime: new Date()
        }
      };

    default:
      return state;
  }
}

// Context
interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  // Helper functions
  addMessage: (message: ChatMessage) => void;
  updateLeadData: (data: Partial<LeadData>) => void;
  updateConversationData: (data: Partial<ConversationData>) => void;
  setPhase: (phase: PhaseType) => void;
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Provider
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Helper functions
  const addMessage = (message: ChatMessage) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  };

  const updateLeadData = (data: Partial<LeadData>) => {
    dispatch({ type: 'UPDATE_LEAD_DATA', payload: data });
  };

  const updateConversationData = (data: Partial<ConversationData>) => {
    dispatch({ type: 'UPDATE_CONVERSATION_DATA', payload: data });
  };

  const setPhase = (phase: PhaseType) => {
    dispatch({ type: 'SET_PHASE', payload: phase });
  };

  const resetChat = () => {
    dispatch({ type: 'RESET_CHAT' });
  };

  const value: ChatContextValue = {
    state,
    dispatch,
    addMessage,
    updateLeadData,
    updateConversationData,
    setPhase,
    resetChat
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Hook
export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}