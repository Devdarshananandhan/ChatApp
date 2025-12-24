export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'server';
  from?: string;
  to?: string;
  room?: string;
  chatKey?: string;
  timestamp: Date;
  filename?: string;
  fileData?: string;
}

export type ChatTarget =
  | { type: 'dm'; user: string }
  | { type: 'room'; room: string };

export interface ChatState {
  messages: Message[];
  currentMessage: string;
  isConnected: boolean;
  serverAddress: string;
  serverPort: string;
  username: string;
}
