/**
 * API configuration and utility functions for connecting to the Flask backend
 */

// API base URL - adjust this based on your environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

export interface ApiTicket {
  ticket_id: number;
  author_id: number;
  assignee_id: number | null;
  department: number;
  department_name?: string | null;
  priority: number | null;
  subject: string;
  message: string;
  status: number; // 0: CLOSED, 1: OPEN, 2: AWAITING_AUTHOR, 3: AWAITING_ASSIGNEE
  created_at: string;
  last_updated: string;
  author_name?: string | null;
  assignee_name?: string | null;
}

export interface ApiUser {
  user_id: number;
  email: string;
  display_name: string;
  role: string;
  created_at: string | null;
  major_id: number | null;
  minor_id: number | null;
  department_id: number | null;
}

export interface TicketsResponse {
  tickets: ApiTicket[];
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  next_page: number | null;
  prev_page: number | null;
}

/**
 * Make an API request with proper error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for session management
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all tickets with optional filters
 */
export async function getTickets(params?: {
  page?: number;
  per_page?: number;
  status?: number;
  department?: number;
  priority?: number;
  created?: string;
  updated?: string;
  text?: string;
}): Promise<TicketsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const queryString = queryParams.toString();
  const endpoint = `/api/get_tickets${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<TicketsResponse>(endpoint);
}

/**
 * Submit a new ticket
 */
export async function submitTicket(data: {
  department: number;
  subject: string;
  message: string;
}): Promise<{ message: string; ticket: ApiTicket }> {
  return apiRequest<{ message: string; ticket: ApiTicket }>('/api/submit_ticket', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Login a user (sets session cookie)
 */
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: 'include', // Include cookies for session management
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Login failed: ${res.statusText}`);
  }
}

/**
 * Sign up a new user and send verification email
 */
export async function signup(data: {
  email: string;
  name: string;
  password: string;
  role?: string;
}): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.message || `Signup failed: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Verify user email with verification code
 */
export async function verifyEmail(email: string, code: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/verify/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: 'include',
    body: JSON.stringify({ code })
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.message || `Verification failed: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  await apiRequest<{ message: string }>('/api/logout', { method: 'POST' });
}

/**
 * Get current user from session
 */
export async function getCurrentUser(): Promise<ApiUser | null> {
  try {
    return await apiRequest<ApiUser>('/api/current_user');
  } catch {
    return null;
  }
}

export interface TicketDetails {
  ticket_id: number;
  author: string | null;
  author_id: number | null;
  assignee: string | null;
  assignee_id: number | null;
  department: string | null;
  department_id: number | null;
  priority: number | null;
  subject: string;
  body: string;
  status: string | null;
  status_code: number | null;
  created_at: string | null;
  last_updated: string | null;
  responses: Array<{
    message: string;
    created_at: string;
    ticket: number;
    author_id: number;
    author_name: string;
  }>;
}

/**
 * Get ticket details by ID
 */
export async function getTicketDetails(ticketId: string | number): Promise<TicketDetails> {
  return apiRequest<TicketDetails>(`/api/ticket_details?ticket_id=${ticketId}`);
}

export interface ArchivedTicketDetailsResponse {
  author: string | null;
  assignee: string | null;
  department: string | null;
  priority: number | null;
  subject: string;
  body: string;
  status: string | null;
  created_at: string | null;
  last_updated: string | null;
  responses: Array<{
    message: string;
    created_at: string;
    ticket: number;
    author_id: number;
    author_name: string;
  }>;
}

/**
 * Get archived ticket details by ID
 */
export async function getArchivedTicketDetails(
  ticketId: string | number
): Promise<TicketDetails> {
  const data = await apiRequest<ArchivedTicketDetailsResponse>(
    `/api/archived_ticket_details?ticket_id=${ticketId}`
  );

  return {
    ticket_id: Number(ticketId),
    author: data.author,
    author_id: null,
    assignee: data.assignee,
    assignee_id: null,
    department: data.department,
    department_id: null,
    priority: data.priority,
    subject: data.subject,
    body: data.body,
    status: data.status,
    status_code: null,
    created_at: data.created_at,
    last_updated: data.last_updated,
    responses: data.responses,
  };
}

export interface UsersResponse {
  users: ApiUser[];
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  next_page: number | null;
  prev_page: number | null;
}

/**
 * Get users (advisors/admins only)
 */
export async function getUsers(params?: {
  role?: string;
  email?: string;
  name?: string;
  major_id?: number;
  minor_id?: number;
  department_id?: number;
  page?: number;
  per_page?: number;
}): Promise<UsersResponse> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const queryString = queryParams.toString();
  const endpoint = `/api/get_users${queryString ? `?${queryString}` : ""}`;

  return apiRequest<UsersResponse>(endpoint);
}

/**
 * Update an existing ticket
 */
export async function updateTicket(data: {
  ticket_id: number;
  assignee?: number | null;
  department?: number | null;
  subject?: string;
  message?: string;
  priority?: number | null;
  status?: string;
}): Promise<{ message: string; ticket: ApiTicket }> {
  return apiRequest<{ message: string; ticket: ApiTicket }>("/api/update_ticket", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Archive an existing ticket (advisors/admins only)
 */
export async function archiveTicket(ticket_id: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/archive_ticket", {
    method: "POST",
    body: JSON.stringify({ ticket_id }),
  });
}

export interface Department {
  department_id: number;
  name: string;
}

/**
 * Get all departments
 */
export async function getDepartments(): Promise<Department[]> {
  return apiRequest<Department[]>('/api/departments');
}

/**
 * Create a response for a ticket
 */
export async function createResponse(data: {
  ticket_id: number;
  message: string;
}): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/create_response', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      "Allow-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(data),
  });
}

/**
 * Get archived tickets with optional filters
 */
export async function getArchivedTickets(params?: {
  page?: number;
  per_page?: number;
  status?: number;
  department?: number;
  priority?: number;
  created?: string;
  updated?: string;
  text?: string;
}): Promise<TicketsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const queryString = queryParams.toString();
  const endpoint = `/api/get_archived_tickets${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<TicketsResponse>(endpoint);
}
