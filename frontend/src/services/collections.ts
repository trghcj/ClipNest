import apiClient from './api';
import type { Bookmark } from './bookmarks';

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const getCollections = async (): Promise<Collection[]> => {
  const response = await apiClient.get('collections/');
  return response.data;
};

export const createCollection = async (data: { name: string; description?: string }): Promise<Collection> => {
  const response = await apiClient.post('collections/', data);
  return response.data;
};

export const updateCollection = async (id: string, updates: { name?: string; description?: string }): Promise<Collection> => {
  const response = await apiClient.put(`collections/${id}`, updates);
  return response.data;
};

export const deleteCollection = async (id: string): Promise<void> => {
  await apiClient.delete(`collections/${id}`);
};

export const addBookmarkToCollection = async (collectionId: string, bookmarkId: string): Promise<void> => {
  await apiClient.post(`collections/${collectionId}/bookmarks/${bookmarkId}`);
};

export const removeBookmarkFromCollection = async (collectionId: string, bookmarkId: string): Promise<void> => {
  await apiClient.delete(`collections/${collectionId}/bookmarks/${bookmarkId}`);
};

export const getCollectionBookmarks = async (collectionId: string): Promise<Bookmark[]> => {
  const response = await apiClient.get(`collections/${collectionId}/bookmarks`);
  return response.data;
};
