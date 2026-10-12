import { request } from './client';

export const eventApi = {
  /**
   * Get events from the event buffer
   * @param options Optional filtering and pagination options
   * @returns Promise resolving to events data
   */
  getEvents: (options: {
    limit?: number;
    type?: string;
    startTime?: number;
    endTime?: number;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
    if (options.type !== undefined) queryParams.append('type', options.type);
    if (options.startTime !== undefined) queryParams.append('startTime', options.startTime.toString());
    if (options.endTime !== undefined) queryParams.append('endTime', options.endTime.toString());
    
    const queryString = queryParams.toString();
    return request(`/events${queryString ? `?${queryString}` : ''}`);
  },
  
  /**
   * Get a specific number of most recent events
   * @param count Number of events to return
   * @returns Promise resolving to events data
   */
  getRecentEvents: (count: number) => 
    request(`/events?limit=${count}`),
    
  /**
   * Get events of a specific type
   * @param type Event type to filter by
   * @param limit Optional limit on number of events to return
   * @returns Promise resolving to events data
   */
  getEventsByType: (type: string, limit?: number) => 
    request(`/events?type=${type}${limit ? `&limit=${limit}` : ''}`),
};