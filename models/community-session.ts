import { DataTypes, Model, Optional, type HasManyGetAssociationsMixin, type HasManyAddAssociationMixin, type HasManyAddAssociationsMixin, type HasManySetAssociationsMixin, type HasManyCreateAssociationMixin, type BelongsToGetAssociationMixin, type BelongsToSetAssociationMixin, type BelongsToCreateAssociationMixin, type BelongsToManyGetAssociationsMixin, type BelongsToManyAddAssociationMixin, type BelongsToManyAddAssociationsMixin, type BelongsToManySetAssociationsMixin } from 'sequelize';
import sequelize from '../config/database';

export type CommunitySessionType = 'video' | 'image' | 'document' | 'audio';

export interface CommunitySessionAttributes {
  id: string;
  title: string;
  shortDescription: string;
  documentId: string | null;
  type: CommunitySessionType;
  allowedRoles: string[]; // Array of role names/IDs that can view this session
  createdBy: string; // User ID of the admin who created this
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CommunitySessionCreationAttributes = Optional<CommunitySessionAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>;

class CommunitySession extends Model<CommunitySessionAttributes, CommunitySessionCreationAttributes> implements CommunitySessionAttributes {
  declare id: string;
  declare title: string;
  declare shortDescription: string;
  declare documentId: string | null;
  declare type: CommunitySessionType;
  declare allowedRoles: string[];
  declare createdBy: string;
  declare isActive: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // belongsTo(Document) association mixins
  declare getDocument: BelongsToGetAssociationMixin<any>;
  declare setDocument: BelongsToSetAssociationMixin<any, string>;
  declare createDocument: BelongsToCreateAssociationMixin<any>;
  declare readonly document?: any;

  // hasMany(Comment) association mixins
  declare getComments: HasManyGetAssociationsMixin<any>;
  declare addComment: HasManyAddAssociationMixin<any, string>;
  declare addComments: HasManyAddAssociationsMixin<any, string>;
  declare setComments: HasManySetAssociationsMixin<any, string>;
  declare createComment: HasManyCreateAssociationMixin<any>;
  declare readonly comments?: any[];

  // belongsToMany(Role) association mixins (defined in models/index.ts)
  declare getRoles: BelongsToManyGetAssociationsMixin<any>;
  declare addRole: BelongsToManyAddAssociationMixin<any, string>;
  declare addRoles: BelongsToManyAddAssociationsMixin<any, string>;
  declare setRoles: BelongsToManySetAssociationsMixin<any, string>;
  declare readonly roles?: any[];

  // Convenience: link/unlink a document directly by id
  public async linkDocumentById(documentId: string | null) {
    await this.update({ documentId });
    return this;
  }

  // Convenience: set allowed roles by ids (also update JSON cache field)
  public async setAllowedRolesByIds(roleIds: string[]) {
    await this.update({ allowedRoles: roleIds });
    // Sync many-to-many associations (defined in models/index.ts)
    await (this as any).setRoles(roleIds);
    return this;
  }
}

CommunitySession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Title of the community session',
    },
    shortDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
      field: 'short_description',
      comment: 'Brief description of the community session content',
    },
    documentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'document_id',
      comment: 'Reference to the associated document (video, image, etc.)',
    },
    type: {
      type: DataTypes.ENUM('video', 'image', 'document', 'audio'),
      allowNull: false,
      comment: 'Type of content in this community session',
    },
    allowedRoles: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'allowed_roles',
      comment: 'Array of role names/IDs that can view this session',
      validate: {
        isArrayValidator(value: unknown) {
          if (!Array.isArray(value)) {
            throw new Error('allowedRoles must be an array');
          }
        }
      }
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      comment: 'User ID of the admin who created this session',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether this community session is currently active/visible',
    },
  },
  {
    sequelize,
    modelName: 'CommunitySession',
    tableName: 'community_sessions',
    timestamps: true,
    indexes: []
  }
);

export default CommunitySession;
