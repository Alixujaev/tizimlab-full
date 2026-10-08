export interface CompanyDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usersCount?: number;
}

export interface CreateCompanyResultDto {
  company: CompanyDto;
  adminUserId: string;
  adminUser: {
    id: string;
    email: string;
    fullName: string;
    role: 'admin';
    isActive: boolean;
  };
}
