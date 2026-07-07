import apiClient from './api';

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  target_id?: string;
  created_at: string;
}

export const getActivities = async (limit: number = 50): Promise<ActivityLog[]> => {
  const response = await apiClient.get<ActivityLog[]>(`/activities?limit=${limit}`);
  return response.data;
};
