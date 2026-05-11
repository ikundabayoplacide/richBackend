import { IUserInstance } from './user-types';

declare global {
  namespace Express {
    interface Request {
      user?: IUserInstance;
    }
  }
}
