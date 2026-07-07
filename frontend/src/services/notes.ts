import apiClient from './api';

export interface Note {
  id: string;
  bookmark_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export const getNote = async (bookmarkId: string): Promise<Note | null> => {
  try {
    const response = await apiClient.get<Note>(`/bookmarks/${bookmarkId}/note`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const upsertNote = async (bookmarkId: string, content: string): Promise<Note> => {
  const response = await apiClient.put<Note>(`/bookmarks/${bookmarkId}/note`, { content });
  return response.data;
};
