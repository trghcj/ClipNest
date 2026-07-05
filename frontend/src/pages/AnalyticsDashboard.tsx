import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, BookOpen, Clock, Tag as TagIcon, Loader2 } from 'lucide-react';

interface AnalyticsData {
  total_bookmarks: number;
  read_bookmarks: number;
  unread_bookmarks: number;
  bookmarks_last_30_days: { date: string; count: number }[];
  top_tags: { name: string; count: number }[];
}

export const AnalyticsDashboard: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const res = await apiClient.get('analytics/');
      return res.data as AnalyticsData;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const pieData = [
    { name: 'Read', value: data.read_bookmarks },
    { name: 'Unread', value: data.unread_bookmarks }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Reading Analytics</h2>
        <p className="text-muted-foreground mt-1">Insights into your bookmarking habits</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Total Saved</div>
            <div className="text-2xl font-bold text-foreground">{data.total_bookmarks}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <Activity className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Read</div>
            <div className="text-2xl font-bold text-foreground">{data.read_bookmarks}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 rounded-lg">
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Unread</div>
            <div className="text-2xl font-bold text-foreground">{data.unread_bookmarks}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg">
            <TagIcon className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Top Tag</div>
            <div className="text-xl font-bold text-foreground truncate max-w-[120px]">
              {data.top_tags[0]?.name || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-6">Activity (Last 30 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.bookmarks_last_30_days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={(str) => str.split('-')[2]} tick={{ fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-foreground mb-6">Read vs Unread</h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={COLORS[1]} />
                  <Cell fill={COLORS[2]} />
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-foreground">
                {data.total_bookmarks > 0 ? Math.round((data.read_bookmarks / data.total_bookmarks) * 100) : 0}%
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Read</span>
            </div>
          </div>
        </div>

      </div>
      
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-6">Top Tags</h3>
        <div className="flex flex-wrap gap-4">
          {data.top_tags.map((tag, index) => (
            <div key={tag.name} className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg border border-border/50">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS[index % COLORS.length]}20`, color: COLORS[index % COLORS.length] }}>
                #{index + 1}
              </div>
              <div>
                <div className="font-medium text-foreground">{tag.name}</div>
                <div className="text-xs text-muted-foreground">{tag.count} bookmarks</div>
              </div>
            </div>
          ))}
          {data.top_tags.length === 0 && (
            <p className="text-muted-foreground">No tags generated yet.</p>
          )}
        </div>
      </div>

    </div>
  );
};
