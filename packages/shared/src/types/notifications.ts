export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationCategory =
  | 'yield'
  | 'bridge'
  | 'governance'
  | 'array'
  | 'system'
  | 'wallet';

export interface Notification {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  read: boolean;
  /** Optional link to navigate to (e.g. "/arrays/abc123"). */
  actionUrl: string | null;
  /** Optional CTA label for the action. */
  actionLabel: string | null;
  createdAt: number;
  readAt: number | null;
  /** Optional array context. */
  arrayId: string | null;
  /** Optional transaction context. */
  txHash: string | null;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  categories: {
    yield: boolean;
    bridge: boolean;
    governance: boolean;
    array: boolean;
    system: boolean;
    wallet: boolean;
  };
}

export interface NotificationCount {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
}
