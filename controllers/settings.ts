import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import sequelize from '../config/database';
import db from '@/models';

interface SlideshowRequest {
  imageUrl: string;
  altText: string;
  statisticsTitle: string;
  statisticsLabel: string;
  statisticsValue: string;
  order?: number;
  isActive?: boolean;
}

interface ImpactRequest {
  icon: string;
  value: string;
  label: string;
  color: string;
  order?: number;
  isActive?: boolean;
}

interface SettingsCreateRequest {
  websiteName: string;
  websiteDescription?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  socialLinks?: Record<string, string>;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  isActive?: boolean;
  slideshows?: SlideshowRequest[];
  impacts?: ImpactRequest[];
}

interface SettingsUpdateRequest extends Partial<SettingsCreateRequest> {
  removeSlideshowIds?: string[];
  removeImpactIds?: string[];
}

@Route('api/settings')
@Tags('Settings')
export class SettingsController extends Controller {
  
  @Get('/')
  @asyncCatch
  public async getSettings(): Promise<ServiceResponse<any>> {
    // Get the active settings (there should typically be only one)
    const settings = await db.Settings.findOne({
      where: { isActive: true },
      include: [
        {
          model: db.Slideshow,
          as: 'slideshows',
          where: { isActive: true },
          required: false,
          order: [['order', 'ASC']],
        },
        {
          model: db.Impact,
          as: 'impacts',
          where: { isActive: true },
          required: false,
          order: [['order', 'ASC']],
        },
      ],
      order: [
        [{ model: db.Slideshow, as: 'slideshows' }, 'order', 'ASC'],
        [{ model: db.Impact, as: 'impacts' }, 'order', 'ASC'],
      ],
    });

    if (!settings) {
      return ServiceResponse.failure('No active settings found', null, 404);
    }

    return ServiceResponse.success('Settings retrieved successfully', settings);
  }

  @Get('/{id}')
  @asyncCatch
  public async getSettingsById(@Path() id: string): Promise<ServiceResponse<any>> {
    const settings = await db.Settings.findByPk(id, {
      include: [
        {
          model: db.Slideshow,
          as: 'slideshows',
          order: [['order', 'ASC']],
        },
        {
          model: db.Impact,
          as: 'impacts',
          order: [['order', 'ASC']],
        },
      ],
      order: [
        [{ model: db.Slideshow, as: 'slideshows' }, 'order', 'ASC'],
        [{ model: db.Impact, as: 'impacts' }, 'order', 'ASC'],
      ],
    });

    if (!settings) {
      return ServiceResponse.failure('Settings not found', null, 404);
    }

    return ServiceResponse.success('Settings retrieved successfully', settings);
  }

  @Security('jwt', ['settings:create'])
  @Post('/')
  @asyncCatch
  public async createSettings(@Body() requestBody: SettingsCreateRequest): Promise<ServiceResponse<any>> {
    const transaction = await sequelize.transaction();

    try {
      // Deactivate any existing active settings
      await db.Settings.update(
        { isActive: false },
        { where: { isActive: true }, transaction }
      );

      // Create new settings
      const settings = await db.Settings.create(
        {
          websiteName: requestBody.websiteName,
          websiteDescription: requestBody.websiteDescription,
          logoUrl: requestBody.logoUrl,
          faviconUrl: requestBody.faviconUrl,
          primaryColor: requestBody.primaryColor,
          secondaryColor: requestBody.secondaryColor,
          contactEmail: requestBody.contactEmail,
          contactPhone: requestBody.contactPhone,
          address: requestBody.address,
          socialLinks: requestBody.socialLinks || {},
          metaTitle: requestBody.metaTitle,
          metaDescription: requestBody.metaDescription,
          metaKeywords: requestBody.metaKeywords,
          isActive: requestBody.isActive !== false, // Default to true
        },
        { transaction }
      );

      // Create slideshows if provided
      if (requestBody.slideshows && requestBody.slideshows.length > 0) {
        const slideshowsData = requestBody.slideshows.map((slideshow, index) => ({
          settingsId: settings.id,
          imageUrl: slideshow.imageUrl,
          altText: slideshow.altText,
          statisticsTitle: slideshow.statisticsTitle,
          statisticsLabel: slideshow.statisticsLabel,
          statisticsValue: slideshow.statisticsValue,
          order: slideshow.order !== undefined ? slideshow.order : index,
          isActive: slideshow.isActive !== false,
        }));

        await db.Slideshow.bulkCreate(slideshowsData, { transaction });
      }

      // Create impacts if provided
      if (requestBody.impacts && requestBody.impacts.length > 0) {
        const impactsData = requestBody.impacts.map((impact, index) => ({
          settingsId: settings.id,
          icon: impact.icon,
          value: impact.value,
          label: impact.label,
          color: impact.color,
          order: impact.order !== undefined ? impact.order : index,
          isActive: impact.isActive !== false,
        }));

        await db.Impact.bulkCreate(impactsData, { transaction });
      }

      await transaction.commit();

      // Fetch the complete settings with associations
      const createdSettings = await db.Settings.findByPk(settings.id, {
        include: [
          { model: db.Slideshow, as: 'slideshows', order: [['order', 'ASC']] },
          { model: db.Impact, as: 'impacts', order: [['order', 'ASC']] },
        ],
        order: [
          [{ model: db.Slideshow, as: 'slideshows' }, 'order', 'ASC'],
          [{ model: db.Impact, as: 'impacts' }, 'order', 'ASC'],
        ],
      });

      return ServiceResponse.success('Settings created successfully', createdSettings, 201);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  @Security('jwt', ['settings:update'])
  @Put('/{id}')
  @asyncCatch
  public async updateSettings(
    @Path() id: string,
    @Body() requestBody: SettingsUpdateRequest
  ): Promise<ServiceResponse<any>> {
    const transaction = await sequelize.transaction();

    try {
      const settings = await db.Settings.findByPk(id, { transaction });
      if (!settings) {
        await transaction.rollback();
        return ServiceResponse.failure('Settings not found', null, 404);
      }

      // Update settings
      await settings.update(
        {
          websiteName: requestBody.websiteName || settings.websiteName,
          websiteDescription: requestBody.websiteDescription !== undefined ? requestBody.websiteDescription : settings.websiteDescription,
          logoUrl: requestBody.logoUrl !== undefined ? requestBody.logoUrl : settings.logoUrl,
          faviconUrl: requestBody.faviconUrl !== undefined ? requestBody.faviconUrl : settings.faviconUrl,
          primaryColor: requestBody.primaryColor !== undefined ? requestBody.primaryColor : settings.primaryColor,
          secondaryColor: requestBody.secondaryColor !== undefined ? requestBody.secondaryColor : settings.secondaryColor,
          contactEmail: requestBody.contactEmail !== undefined ? requestBody.contactEmail : settings.contactEmail,
          contactPhone: requestBody.contactPhone !== undefined ? requestBody.contactPhone : settings.contactPhone,
          address: requestBody.address !== undefined ? requestBody.address : settings.address,
          socialLinks: requestBody.socialLinks !== undefined ? requestBody.socialLinks : settings.socialLinks,
          metaTitle: requestBody.metaTitle !== undefined ? requestBody.metaTitle : settings.metaTitle,
          metaDescription: requestBody.metaDescription !== undefined ? requestBody.metaDescription : settings.metaDescription,
          metaKeywords: requestBody.metaKeywords !== undefined ? requestBody.metaKeywords : settings.metaKeywords,
          isActive: requestBody.isActive !== undefined ? requestBody.isActive : settings.isActive,
        },
        { transaction }
      );

      // Handle slideshow removals
      if (requestBody.removeSlideshowIds && requestBody.removeSlideshowIds.length > 0) {
        await db.Slideshow.destroy({
          where: {
            id: requestBody.removeSlideshowIds,
            settingsId: id,
          },
          transaction,
        });
      }

      // Handle impact removals
      if (requestBody.removeImpactIds && requestBody.removeImpactIds.length > 0) {
        await db.Impact.destroy({
          where: {
            id: requestBody.removeImpactIds,
            settingsId: id,
          },
          transaction,
        });
      }

      // Add new slideshows
      if (requestBody.slideshows && requestBody.slideshows.length > 0) {
        const slideshowsData = requestBody.slideshows.map((slideshow, index) => ({
          settingsId: id,
          imageUrl: slideshow.imageUrl,
          altText: slideshow.altText,
          statisticsTitle: slideshow.statisticsTitle,
          statisticsLabel: slideshow.statisticsLabel,
          statisticsValue: slideshow.statisticsValue,
          order: slideshow.order !== undefined ? slideshow.order : index,
          isActive: slideshow.isActive !== false,
        }));

        await db.Slideshow.bulkCreate(slideshowsData, { transaction });
      }

      // Add new impacts
      if (requestBody.impacts && requestBody.impacts.length > 0) {
        const impactsData = requestBody.impacts.map((impact, index) => ({
          settingsId: id,
          icon: impact.icon,
          value: impact.value,
          label: impact.label,
          color: impact.color,
          order: impact.order !== undefined ? impact.order : index,
          isActive: impact.isActive !== false,
        }));

        await db.Impact.bulkCreate(impactsData, { transaction });
      }

      await transaction.commit();

      // Fetch updated settings with associations
      const updatedSettings = await db.Settings.findByPk(id, {
        include: [
          { model: db.Slideshow, as: 'slideshows', order: [['order', 'ASC']] },
          { model: db.Impact, as: 'impacts', order: [['order', 'ASC']] },
        ],
        order: [
          [{ model: db.Slideshow, as: 'slideshows' }, 'order', 'ASC'],
          [{ model: db.Impact, as: 'impacts' }, 'order', 'ASC'],
        ],
      });

      return ServiceResponse.success('Settings updated successfully', updatedSettings);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  @Security('jwt', ['settings:delete'])
  @Delete('/{id}')
  @asyncCatch
  public async deleteSettings(@Path() id: string): Promise<ServiceResponse<null>> {
    const settings = await db.Settings.findByPk(id);
    if (!settings) {
      return ServiceResponse.failure('Settings not found', null, 404);
    }

    // Soft delete by setting isActive to false
    await settings.update({ isActive: false });

    return ServiceResponse.success('Settings deleted successfully', null);
  }

  // Additional endpoints for managing slideshows and impacts separately

  @Security('jwt', ['settings:update'])
  @Post('/{id}/slideshows')
  @asyncCatch
  public async addSlideshow(
    @Path() id: string,
    @Body() requestBody: SlideshowRequest
  ): Promise<ServiceResponse<any>> {
    const settings = await db.Settings.findByPk(id);
    if (!settings) {
      return ServiceResponse.failure('Settings not found', null, 404);
    }

    const slideshow = await db.Slideshow.create({
      settingsId: id,
      imageUrl: requestBody.imageUrl,
      altText: requestBody.altText,
      statisticsTitle: requestBody.statisticsTitle,
      statisticsLabel: requestBody.statisticsLabel,
      statisticsValue: requestBody.statisticsValue,
      order: requestBody.order || 0,
      isActive: requestBody.isActive !== false,
    });

    return ServiceResponse.success('Slideshow added successfully', slideshow, 201);
  }

  @Security('jwt', ['settings:update'])
  @Post('/{id}/impacts')
  @asyncCatch
  public async addImpact(
    @Path() id: string,
    @Body() requestBody: ImpactRequest
  ): Promise<ServiceResponse<any>> {
    const settings = await db.Settings.findByPk(id);
    if (!settings) {
      return ServiceResponse.failure('Settings not found', null, 404);
    }

    const impact = await db.Impact.create({
      settingsId: id,
      icon: requestBody.icon,
      value: requestBody.value,
      label: requestBody.label,
      color: requestBody.color,
      order: requestBody.order || 0,
      isActive: requestBody.isActive !== false,
    });

    return ServiceResponse.success('Impact added successfully', impact, 201);
  }

  @Security('jwt', ['settings:update'])
  @Put('/slideshows/{slideshowId}')
  @asyncCatch
  public async updateSlideshow(
    @Path() slideshowId: string,
    @Body() requestBody: Partial<SlideshowRequest>
  ): Promise<ServiceResponse<any>> {
    const slideshow = await db.Slideshow.findByPk(slideshowId);
    if (!slideshow) {
      return ServiceResponse.failure('Slideshow not found', null, 404);
    }

    await slideshow.update(requestBody);
    return ServiceResponse.success('Slideshow updated successfully', slideshow);
  }

  @Security('jwt', ['settings:update'])
  @Put('/impacts/{impactId}')
  @asyncCatch
  public async updateImpact(
    @Path() impactId: string,
    @Body() requestBody: Partial<ImpactRequest>
  ): Promise<ServiceResponse<any>> {
    const impact = await db.Impact.findByPk(impactId);
    if (!impact) {
      return ServiceResponse.failure('Impact not found', null, 404);
    }

    await impact.update(requestBody);
    return ServiceResponse.success('Impact updated successfully', impact);
  }

  @Security('jwt', ['settings:delete'])
  @Delete('/slideshows/{slideshowId}')
  @asyncCatch
  public async deleteSlideshow(@Path() slideshowId: string): Promise<ServiceResponse<null>> {
    const slideshow = await db.Slideshow.findByPk(slideshowId);
    if (!slideshow) {
      return ServiceResponse.failure('Slideshow not found', null, 404);
    }

    await slideshow.destroy();
    return ServiceResponse.success('Slideshow deleted successfully', null);
  }

  @Security('jwt', ['settings:delete'])
  @Delete('/impacts/{impactId}')
  @asyncCatch
  public async deleteImpact(@Path() impactId: string): Promise<ServiceResponse<null>> {
    const impact = await db.Impact.findByPk(impactId);
    if (!impact) {
      return ServiceResponse.failure('Impact not found', null, 404);
    }

    await impact.destroy();
    return ServiceResponse.success('Impact deleted successfully', null);
  }
}
