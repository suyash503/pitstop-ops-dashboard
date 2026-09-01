/**
 * Mirror of the API response contract.
 *
 * Hand-maintained rather than generated: the surface is small, and a generation
 * step in the build would be one more thing to keep alive for very little gain.
 * The source of truth is the OpenAPI document the backend serves at /api/docs.
 */

export type BookingStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type MechanicStatus = 'AVAILABLE' | 'ON_JOB' | 'OFF_DUTY';

export type Role = 'ADMIN' | 'OPS';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type PaginatedMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export type Kpi = {
  value: number;
  delta: number | null;
};

export type DashboardResponse = {
  range: { key: string; days: number; from: string; to: string; timezone: string };
  kpis: {
    totalBookings: Kpi;
    todayBookings: Kpi;
    completedBookings: Kpi;
    pendingBookings: Kpi;
    cancelledBookings: Kpi;
    totalRevenue: Kpi;
    activeMechanics: Kpi;
    newCustomers: Kpi;
  };
  timeseries: { date: string; bookings: number; revenue: number }[];
  statusBreakdown: { status: BookingStatus; count: number }[];
  serviceBreakdown: { category: string; count: number; revenue: number }[];
  recentActivity: ActivityItem[];
};

export type ActivityItem = {
  id: string;
  bookingId: string;
  code: string;
  customerName: string;
  serviceName: string;
  from: BookingStatus | null;
  to: BookingStatus;
  actor: string;
  createdAt: string;
};

export type BookingListItem = {
  id: string;
  code: string;
  status: BookingStatus;
  amount: number;
  city: string;
  scheduledAt: string;
  createdAt: string;
  completedAt: string | null;
  customer: { id: string; name: string; phone: string };
  vehicle: { id: string; make: string; model: string; regNo: string };
  service: { id: string; name: string; category: string };
  mechanic: { id: string; name: string; status: MechanicStatus } | null;
};

export type BookingEvent = {
  id: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  note: string | null;
  actor: string;
  createdAt: string;
};

export type BookingDetail = {
  id: string;
  code: string;
  status: BookingStatus;
  amount: number;
  city: string;
  notes: string | null;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  customer: { id: string; name: string; email: string; phone: string; city: string };
  vehicle: { id: string; make: string; model: string; year: number; regNo: string; fuelType: string };
  service: { id: string; name: string; category: string; basePrice: number; durationMins: number };
  mechanic: { id: string; name: string; phone: string; specialization: string; status: MechanicStatus } | null;
  events: BookingEvent[];
};

export type MechanicListItem = {
  id: string;
  name: string;
  phone: string;
  specialization: string;
  status: MechanicStatus;
  rating: number;
  jobsCompleted: number;
  city: string;
  lat: number;
  lng: number;
  hiredAt: string;
  currentBooking: MechanicBookingRef | null;
  lastBooking: MechanicBookingRef | null;
};

export type MechanicBookingRef = {
  id: string;
  code: string;
  status: BookingStatus;
  scheduledAt: string;
  createdAt: string;
  customer: { name: string };
  service: { name: string };
};

export type CustomerListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  bookingCount: number;
  vehicleCount: number;
  lifetimeValue: number;
};

export type ServiceItem = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  durationMins: number;
};
