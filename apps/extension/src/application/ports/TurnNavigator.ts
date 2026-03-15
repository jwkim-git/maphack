export interface TurnNavigationTarget {
  conversationId: string;
  conversationUrl: string;
  messageId: string;
  turnIndex: number;
}

export interface TurnNavigator {
  navigateWithinConversation(target: TurnNavigationTarget): Promise<void>;
  navigateAcrossConversations(target: TurnNavigationTarget): Promise<void>;
  consumePendingNavigation(readyConversationId: string): Promise<void>;
}
