export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: number;
  error?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface FilterParams {
  status?: string;
  type?: string;
  dateRange?: [string, string];
  search?: string;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

export interface LoadingState {
  loading: boolean;
  error: string | null;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  status: 'idle' | 'loading' | 'success' | 'error';
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  closable?: boolean;
}

export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  path?: string;
}

export interface BreadcrumbItem {
  title: string;
  path?: string;
  icon?: React.ReactNode;
}