import type { UserRole } from "@chuying/shared";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        email: string;
        role: UserRole;
        displayName: string;
      };
    }
  }
}

export {};
