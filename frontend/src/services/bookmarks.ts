import apiClient, { API_URL } from './api';
import { auth } from './firebase';

export type BookmarkStatus = 'unread' | 'reading' | 'completed';

export interface Tag {
  id: string;
  name: string;
  is_ai_generated: boolean;
  created_at: string;
}

/** What list endpoints return: everything a card needs, without the extracted page content. */
export interface Bookmark {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  status: BookmarkStatus | null;
  summary: string | null;
  /** Size in bytes of the extracted content (used for reading-time estimates). */
  content_length: number;
  tags?: Tag[];
  created_at: string;
  updated_at: string | null;
}

/** A single bookmark with its extracted content, as loaded by the reader. */
export interface BookmarkDetail extends Bookmark {
  content: string | null;
}

export interface BookmarkUpdate {
  url?: string;
  title?: string;
  description?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  status?: BookmarkStatus;
  tags?: string[];
}

const PAGE_SIZE = 500;

/** Fetches the whole library, page by page (the API caps a page at 500). */
export const getBookmarks = async (): Promise<Bookmark[]> => {
  const all: Bookmark[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const response = await apiClient.get<Bookmark[]>('bookmarks', { params: { skip, limit: PAGE_SIZE } });
    all.push(...response.data);
    if (response.data.length < PAGE_SIZE) return all;
  }
};

export const getBookmark = async (id: string): Promise<BookmarkDetail> => {
  const response = await apiClient.get<BookmarkDetail>(`bookmarks/${id}`);
  return response.data;
};

/** The server fetches the page and extracts title, description, images and content itself. */
export const createBookmark = async (bookmark: { url: string }): Promise<Bookmark> => {
  const response = await apiClient.post<Bookmark>('bookmarks', bookmark);
  return response.data;
};

export const uploadPdfBookmark = async (file: File): Promise<Bookmark> => {
  const formData = new FormData();
  formData.append('file', file);

  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const response = await fetch(`${API_URL}bookmarks/pdf`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Note: intentionally omitting Content-Type so browser sets boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.json().then((d) => d?.detail).catch(() => null);
    throw new Error(typeof detail === 'string' ? detail : 'Failed to upload PDF');
  }

  return response.json();
};

export const deleteBookmark = async (id: string) => {
  const response = await apiClient.delete(`bookmarks/${id}`);
  return response.data;
};

export const updateBookmark = async (id: string, updates: BookmarkUpdate): Promise<Bookmark> => {
  const response = await apiClient.put<Bookmark>(`bookmarks/${id}`, updates);
  return response.data;
};

export const aiSearchBookmarks = async (query: string): Promise<{ matching_ids: string[] }> => {
  const response = await apiClient.post('bookmarks/ai-search', { query });
  return response.data;
};
