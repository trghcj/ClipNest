import apiClient from './api';

export interface Tag {
  id: string;
  name: string;
  is_ai_generated: boolean;
  created_at: string;
}

export const getTags = async (): Promise<Tag[]> => {
  const response = await apiClient.get('tags/');
  return response.data;
};

export const createTag = async (data: { name: string; is_ai_generated?: boolean }): Promise<Tag> => {
  const response = await apiClient.post('tags/', data);
  return response.data;
};

export const deleteTag = async (id: string): Promise<void> => {
  await apiClient.delete(`tags/${id}`);
};

export const addTagToBookmark = async (tagId: string, bookmarkId: string): Promise<void> => {
  await apiClient.post(`tags/${tagId}/bookmarks/${bookmarkId}`);
};

export const removeTagFromBookmark = async (tagId: string, bookmarkId: string): Promise<void> => {
  await apiClient.delete(`tags/${tagId}/bookmarks/${bookmarkId}`);
};
