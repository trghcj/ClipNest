import apiClient from './api';

export interface Bookmark {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  content_type: string;
  is_favorite: boolean;
  is_archived: boolean;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export const getBookmarks = async (): Promise<Bookmark[]> => {
  const response = await apiClient.get('bookmarks/');
  return response.data;
};

export const createBookmark = async (bookmark: Partial<Bookmark>): Promise<Bookmark> => {
  const response = await apiClient.post('bookmarks/', bookmark);
  return response.data;
};

export const extractMetadata = async (url: string) => {
  const response = await apiClient.post('bookmarks/extract-metadata', { url });
  return response.data;
};

export const deleteBookmark = async (id: string) => {
  const response = await apiClient.delete(`bookmarks/${id}`);
  return response.data;
};
