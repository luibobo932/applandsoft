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
  road_types: LookupItem[];
  provinces: LookupItem[];
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
  created_at?: string | null;
  // Cot bo sung cho luoi kieu King Land desktop (backend moi tra ve)
  house_number?: string | null;
  street_name?: string | null;
  property_type_name?: string | null;
  grade_name?: string | null;
  source_name?: string | null;
  direction_name?: string | null;
  agent_name?: string | null;
  phi_mg?: number | null;
  note_doi_gia?: string | null;
  note_da_ban?: string | null;
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
  phone?: string; // tim theo SDT chu nha
  district?: string;
  districts?: string; // nhieu quan, ngan cach dau phay
  ward?: string;
  street?: string;
  status?: string;
  property_type?: string;
  property_types?: string; // nhieu loai nha, ngan cach dau phay (vd nhom hem)
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  width_min?: number;
  sort?: string;
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
  road_width?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: number;
  living_rooms?: number;
  legal_status_code?: string;
  direction_code?: string;
  grade_code?: string;
  negotiable?: boolean;
  direct_owner?: boolean;
  description?: string;
  note?: string;
  listing_type?: string;
  owner_phone2?: string;
  owner_email?: string;
  owner_address?: string;
  original_price?: number;
  brokerage_percent?: number;
  road_type_code?: string;
  province_code?: string;
  back_width?: number;
  has_basement?: boolean;
  has_mezzanine?: boolean;
  has_terrace?: boolean;
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

export type CallLogEmployee = {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  today_call_count: number;
  latest_call_at?: string | null;
};

export type CallLogItem = {
  log_id: number;
  called_at: string;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  landsoft_id: number;
  house_number?: string | null;
  street_name?: string | null;
  district_name?: string | null;
  address?: string | null;
  width?: number | null;
  length?: number | null;
  area?: number | null;
  price?: number | null;
  owner_phone?: string | null;
  created_at?: string | null;
};

export type PagedCallLogsResponse = {
  items: CallLogItem[];
  total: number;
  limit: number;
  after_id?: number | null;
  latest_id?: number | null;
};

export type CustomerSummary = {
  makh: number;
  full_name: string;
  phone?: string | null;
  phone2?: string | null;
  address?: string | null;
  registered_at?: string | null;
  staff_name?: string | null;
  property_count: number;
};

export type CustomerNote = {
  created_at?: string | null;
  title?: string | null;
  content?: string | null;
};

export type CustomerProperty = {
  landsoft_id: number;
  title: string;
  address?: string | null;
  district_name?: string | null;
  price?: number | null;
  area?: number | null;
  status_name?: string | null;
  created_at?: string | null;
};

export type CustomerDetail = CustomerSummary & {
  email?: string | null;
  note_text?: string | null;
  notes: CustomerNote[];
  properties: CustomerProperty[];
};

export type PagedCustomersResponse = {
  items: CustomerSummary[];
  page: number;
  page_size: number;
  total: number;
};

export type EmployeeSummary = {
  manv: number;
  code?: string | null;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  role_name?: string | null;
  locked: boolean;
};

export type PagedEmployeesResponse = {
  items: EmployeeSummary[];
  page: number;
  page_size: number;
  total: number;
};

export type PropertyHistoryItem = {
  history_id: number;
  created_at?: string | null;
  content?: string | null;
  status_name?: string | null;
  staff_name?: string | null;
};
