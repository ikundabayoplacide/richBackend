export interface IEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate: Date;
  interventionAreaId: string;
  bannerImage?: string | null;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'|'active';
  state?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventCreateRequest {
  title: string;
  interventionAreaId: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate: Date;
  bannerImage?: string | null;
  status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
}

export interface IEventUpdateRequest extends Partial<IEventCreateRequest> {}

