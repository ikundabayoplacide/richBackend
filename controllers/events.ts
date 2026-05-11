// controllers/EventController.ts
import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import Event from '@/models/Events';
import { Op } from 'sequelize';
import db from '@/models';
import { IEvent, IEventCreateRequest, IEventUpdateRequest } from '@/types/event.types';

@Route('api/events')
@Tags('Events')
export class EventController extends Controller {
  // Users can view events (read-only access)
  // @Security('jwt', ['event:read'])
  @Get('/')
  @asyncCatch
  public async getEvents(
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled',
    @Query() location?: string,
    @Query() title?: string,
    @Query() interventionAreaId?: string
  ): Promise<ServiceResponse<IEvent[]>> {
    const offset = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (location) where.location = { [Op.iLike]: `%${location}%` }; // Case-insensitive search
    if (title) where.title = { [Op.iLike]: `%${title}%` };
    if (interventionAreaId) where.interventionAreaId = interventionAreaId;

    const { count, rows } = await Event.findAndCountAll({
      where,
      limit,
      offset,
      order: [['startDate', 'ASC']],
      distinct: true,
      include:[
        { model:db.InterventionArea, as:'interventionArea',attributes:['id','name']}]
    });

    return ServiceResponse.success('Events retrieved successfully', rows, 200, {
      meta: {
    total: count,
    page,
    totalPages: Math.ceil(count / limit)
  }});
  }

  // Users can view specific event details
  // @Security('jwt', ['event:read'])
  @Get('/{eventId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Event not found')
  public async getEventById(@Path() eventId: string): Promise<ServiceResponse<IEvent | null>> {
    const event = await Event.findByPk(eventId);
    if (!event) return ServiceResponse.failure('Event not found', null, 404);
    return ServiceResponse.success('Event retrieved successfully', event);
  }

  // Only admins can create events
@Security('jwt', ['event:create'])
@Post('/')
@SuccessResponse(201, 'Created')
@asyncCatch
public async createEvent(@Body() data: IEventCreateRequest): Promise<ServiceResponse<IEvent | null>> {
  console.log('📥 Received data:', JSON.stringify(data, null, 2)); 
  
  // Validate dates with UTC conversion to avoid timezone issues
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const now = new Date();

  // Convert to UTC to avoid timezone issues
  const startUTC = Date.UTC(
    startDate.getFullYear(), 
    startDate.getMonth(), 
    startDate.getDate(), 
    startDate.getHours(), 
    startDate.getMinutes()
  );
  const endUTC = Date.UTC(
    endDate.getFullYear(), 
    endDate.getMonth(), 
    endDate.getDate(), 
    endDate.getHours(), 
    endDate.getMinutes()
  );

  if (startUTC >= endUTC) {
    return ServiceResponse.failure('End date must be after start date', null, 400);
  }

  // Determine status based on current time
  let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming';
  
  if (endUTC < Date.now()) {
    status = 'completed';
  } else if (startUTC <= Date.now() && endUTC >= Date.now()) {
    status = 'ongoing';
  }
  // Otherwise, it remains 'upcoming'

  // Check for existing event with same title and overlapping dates
  const existingEvent = await Event.findOne({
    where: {
      title: data.title,
      interventionAreaId: data.interventionAreaId,
      [Op.or]: [
        {
          startDate: { [Op.lte]: data.endDate },
          endDate: { [Op.gte]: data.startDate }
        }
      ]
    }
  });

  if (existingEvent) {
    return ServiceResponse.failure('An event with the same title and overlapping dates already exists', null, 409);
  }

  const event = await Event.create({
    title: data.title,
    description: data.description ?? null,
    location: data.location ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    interventionAreaId: data.interventionAreaId,
    bannerImage: data.bannerImage ?? null,
    status: status, // Use the calculated status
  });

  this.setStatus(201);
  return ServiceResponse.success('Event created successfully', event, 201);
}

  // Only admins can update events
  // @Security('jwt', ['event:update'])
@Security('jwt', ['event:update'])
@Put('/{eventId}')
@asyncCatch
public async updateEvent(
  @Path() eventId: string,
  @Body() data: IEventUpdateRequest
): Promise<ServiceResponse<IEvent | null>> {
  const event = await Event.findByPk(eventId);
  if (!event) return ServiceResponse.failure('Event not found', null, 404);
  console.log('📥 Received update data:', JSON.stringify(data, null, 2));

  // Use updated dates if provided, otherwise use existing ones
  const startDate = data.startDate ? new Date(data.startDate) : new Date(event.startDate);
  const endDate = data.endDate ? new Date(data.endDate) : new Date(event.endDate);
  const now = new Date();

  // Validate dates with UTC conversion
  const startUTC = Date.UTC(
    startDate.getFullYear(), 
    startDate.getMonth(), 
    startDate.getDate(), 
    startDate.getHours(), 
    startDate.getMinutes()
  );
  const endUTC = Date.UTC(
    endDate.getFullYear(), 
    endDate.getMonth(), 
    endDate.getDate(), 
    endDate.getHours(), 
    endDate.getMinutes()
  );

  if (startUTC >= endUTC) {
    return ServiceResponse.failure('End date must be after start date', null, 400);
  }

  // Determine status based on current time and dates
  let status: 'upcoming' | 'ongoing'|'active' | 'completed' | 'cancelled' = event.status;
  
  // Only auto-update status if it's not manually set to 'cancelled'
  const isCancelled = data.status === 'cancelled' || event.status === 'cancelled';
  
  if (!isCancelled) {
    if (endUTC < Date.now()) {
      status = 'completed';
    } else if (startUTC <= Date.now() && endUTC >= Date.now()) {
      status = 'ongoing';
    } else {
      status = 'upcoming';
    }
  }

  await event.update({
    title: data.title ?? event.title,
    description: data.description ?? event.description,
    location: data.location ?? event.location,
    startDate: data.startDate ?? event.startDate,
    endDate: data.endDate ?? event.endDate,
    interventionAreaId: data.interventionAreaId ?? event.interventionAreaId,
    bannerImage: data.bannerImage ?? event.bannerImage,
    status: data.status ?? status, // Use provided status or calculated one
  });

  this.setStatus(200);
  return ServiceResponse.success('Event updated successfully', event);
}

  // Only admins can delete events
  @Security('jwt', ['event:delete'])
  @Delete('/{eventId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteEvent(@Path() eventId: string): Promise<ServiceResponse<null>> {
    const event = await Event.findByPk(eventId);
    if (!event) return ServiceResponse.failure('Event not found', null, 404);

    await event.destroy();
    this.setStatus(204);
    return ServiceResponse.success('Event deleted successfully', null, 204);
  }

  // Endpoint to get the latest published event for dashboard banner
  @Get('/latest-published')
  @asyncCatch
  public async getLatestPublishedEvent(): Promise<ServiceResponse<IEvent | null>> {
    const now = new Date();
    
    const event = await Event.findOne({
      where: {
        state: 'published',
        endDate: {
          [Op.gt]: now // Only events that haven't ended yet
        }
      },
      order: [['createdAt', 'DESC']], // Get the most recently created published event
      include: [
        { model: db.InterventionArea, as: 'interventionArea', attributes: ['id', 'name'] }
      ]
    });

    if (!event) {
      return ServiceResponse.success('No active published events found', null);
    }

    return ServiceResponse.success('Latest published event retrieved successfully', event);
  }

  // Additional endpoint to get upcoming events
  // @Security('jwt', ['event:read'])
  @Get('/upcoming/events')
  @asyncCatch
  public async getUpcomingEvents(
    @Query() limit: number = 5
  ): Promise<ServiceResponse<IEvent[]>> {
    const events = await Event.findAll({
      where: {
        status: 'upcoming',
        startDate: {
          [Op.gte]: new Date() // Events starting from now onwards
        }
      },
      limit,
      order: [['startDate', 'ASC']],
    });

    return ServiceResponse.success('Upcoming events retrieved successfully', events);
  }

  // Endpoint to update event status automatically (could be called by a cron job)
  @Security('jwt', ['event:update'])
  @Post('/{eventId}/status')
  @asyncCatch
  public async updateEventStatus(@Path() eventId: string): Promise<ServiceResponse<IEvent | null>> {
    const event = await Event.findByPk(eventId);
    if (!event) return ServiceResponse.failure('Event not found', null, 404);

    const now = new Date();
    let newStatus: 'upcoming' | 'ongoing' | 'completed' | 'cancelled' = event.status ?? 'upcoming';

    if (event.status !== 'cancelled') {
      if (now < event.startDate) {
        newStatus = 'upcoming';
      } else if (now >= event.startDate && now <= event.endDate) {
        newStatus = 'ongoing';
      } else if (now > event.endDate) {
        newStatus = 'completed';
      }
    }

    if (newStatus !== event.status) {
      await event.update({ status: newStatus });
    }

    return ServiceResponse.success('Event status updated successfully', event);
  }
  // controller to update state
@Security('jwt', ['event:update'])
@Put('/{eventId}/state')
@asyncCatch
public async updateEventState(
  @Path() eventId: string,
): Promise<ServiceResponse<IEvent | null>> {
  const event = await Event.findByPk(eventId);
  if (!event) return ServiceResponse.failure('Event not found', null, 404);

  if(event.status==='ongoing'|| event.status==='upcoming'){
    await event.update({
      state: 'published'
    });

    this.setStatus(200);
    return ServiceResponse.success('Event state updated successfully', event);
  }

  // If the event is not in a publishable state, return a clear failure response
  return ServiceResponse.failure('Event cannot be published in its current state', null, 400);
}
}
