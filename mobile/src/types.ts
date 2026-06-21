export type LoginPayload = {
  username: string;
  password: string;
};

export type CurrentUser = {
  username: string;
  display_name: string;
  auth_source: string;
  landsoft_username?: string | null;
  landsoft_user_id?: number | null;
  department_id?: number | null;
  role_name?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: CurrentUser;
};

export type LookupItem = {
  code: string;
  label: string;
  parent_code?: string | null;
};

export type LookupCollections = {
  districts: LookupItem[];
  wards: LookupItem[];
  property_types: LookupItem[];
  directions: LookupItem[];
  legal_statuses: LookupItem[];
  statuses: LookupItem[];
  sources: LookupItem[];
  grades: LookupItem[];
};

export type PropertySummary = {
  landsoft_id: number;
  code: string;
  title: string;
  district_code?: string | null;
  district_name?: string | null;
  ward_code?: string | null;
  ward_name?: string | null;
  address?: string | null;
  price?: number | null;
  area?: number | null;
  status_code?: string | null;
  status_name?: string | null;
  description?: string | null;
  owner_name?: string | null;
  contact_phone?: string | null;
  width?: number | null;
  length?: number | null;
};

export type PropertyNote = {
  note_id: number;
  created_at: string;
  created_by: string;
  content: string;
};

export type PropertyDetail = PropertySummary & {
  owner_name?: string | null;
  contact_phone?: string | null;
  legal_status_code?: string | null;
  legal_status_name?: string | null;
  direction_code?: string | null;
  direction_name?: string | null;
  property_type_code?: string | null;
  property_type_name?: string | null;
  source_code?: string | null;
  source_name?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  notes: PropertyNote[];
};

export type PropertyFilters = {
  keyword?: string;
  district?: string;
  ward?: string;
  status?: string;
  property_type?: string;
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  page?: number;
  page_size?: number;
};

export type PagedPropertiesResponse = {
  items: PropertySummary[];
  page: number;
  page_size: number;
  total: number;
};

export type PropertyCreatePayload = {
  title: string;
  address: string;
  district_code: string;
  ward_code: string;
  property_type_code: string;
  status_code: string;
  source_code: string;
  street_name?: string;
  owner_name: string;
  contact_phone: string;
  price: number;
  area: number;
  width?: number;
  length?: number;
  legal_status_code?: string;
  direction_code?: string;
  grade_code?: string;
  description?: string;
  note?: string;
  listing_type?: string;
};

export type ActionResponse = {
  success: boolean;
  landsoft_id?: number | null;
  message: string;
  server_time: string;
};

export type ActivityItem = {
  id?: string;
  username?: string;
  landsoft_username?: string | null;
  action: string;
  entity_type?: string;
  target_type?: string;
  payload?: Record<string, unknown>;
  result_message?: string;
  message?: string;
  created_at?: string;
  server_time?: string;
};
