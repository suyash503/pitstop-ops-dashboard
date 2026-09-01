/**
 * PitStop Ops — database seed.
 *
 * Generates a realistic 90-day operating history for a vehicle service company.
 *
 * Two properties matter here and both are deliberate:
 *
 *  1. Internally consistent. A mechanic's `jobsCompleted` is counted from their
 *     actual completed bookings; their `status` is derived from whether they
 *     currently hold an in-flight job; every booking carries the full
 *     BookingEvent chain that led to its current status. Nothing is a
 *     free-floating random number, because the dashboard aggregates these and
 *     inconsistencies show up as soon as anyone cross-checks two screens.
 *
 *  2. Plausibly shaped. Bookings skew recent and weekday-heavy, older bookings
 *     are always terminal (nothing from 60 days ago is still "on the way"), and
 *     amounts vary around each service base price.
 *
 * Faker is seeded, so names/choices are reproducible. Dates are anchored to the
 * real "now" on purpose — a freshly seeded database should always look current.
 */
import { randomUUID } from 'node:crypto';
import { fakerEN_IN as faker } from '@faker-js/faker';
import { PrismaClient, BookingStatus, MechanicStatus, FuelType, Role } from '@prisma/client';
// Default import, not `import * as`. Newer Node strips TypeScript natively and
// loads this file as ESM, where a namespace import of a CommonJS module does not
// expose its functions — bcrypt.hash comes back undefined. The default import
// resolves to module.exports under both ESM and ts-node's CommonJS output.
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

faker.seed(20260901);

const DAYS_OF_HISTORY = 90;
const COUNTS = { customers: 60, mechanics: 25, bookings: 700 };

const CITIES = [
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, plate: 'KA' },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, plate: 'MH' },
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.209, plate: 'DL' },
  { name: 'Pune', lat: 18.5204, lng: 73.8567, plate: 'MH' },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867, plate: 'TS' },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, plate: 'TN' },
];

const SERVICES = [
  { name: 'General Service', category: 'Periodic Maintenance', basePrice: 2499, durationMins: 120 },
  { name: 'Comprehensive Service', category: 'Periodic Maintenance', basePrice: 4999, durationMins: 240 },
  { name: 'Oil & Filter Change', category: 'Periodic Maintenance', basePrice: 1499, durationMins: 60 },
  { name: 'Brake Pad Replacement', category: 'Repairs', basePrice: 3299, durationMins: 90 },
  { name: 'Clutch Repair', category: 'Repairs', basePrice: 7499, durationMins: 300 },
  { name: 'Suspension Work', category: 'Repairs', basePrice: 5999, durationMins: 240 },
  { name: 'Battery Replacement', category: 'Batteries & Electrical', basePrice: 4499, durationMins: 45 },
  { name: 'Alternator Repair', category: 'Batteries & Electrical', basePrice: 3899, durationMins: 150 },
  { name: 'Wheel Alignment & Balancing', category: 'Tyres & Wheels', basePrice: 1299, durationMins: 60 },
  { name: 'Tyre Replacement', category: 'Tyres & Wheels', basePrice: 6499, durationMins: 75 },
  { name: 'Roadside Assistance', category: 'Emergency', basePrice: 999, durationMins: 45 },
  { name: 'Jump Start & Towing', category: 'Emergency', basePrice: 1899, durationMins: 90 },
];

const VEHICLES = [
  { make: 'Maruti Suzuki', models: ['Swift', 'Baleno', 'Dzire', 'Brezza', 'WagonR'] },
  { make: 'Hyundai', models: ['i20', 'Creta', 'Venue', 'Verna'] },
  { make: 'Tata', models: ['Nexon', 'Punch', 'Harrier', 'Altroz'] },
  { make: 'Mahindra', models: ['XUV700', 'Scorpio N', 'Thar', 'Bolero'] },
  { make: 'Honda', models: ['City', 'Amaze', 'Elevate'] },
  { make: 'Toyota', models: ['Innova Crysta', 'Fortuner', 'Glanza'] },
  { make: 'Kia', models: ['Seltos', 'Sonet', 'Carens'] },
];

const SPECIALIZATIONS = [
  'Engine & Transmission',
  'Brakes & Suspension',
  'Auto Electricals',
  'AC & Cooling',
  'Tyres & Alignment',
  'General Diagnostics',
];

/** The happy path a booking walks. CANCELLED exits from an early state. */
const FLOW: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.ASSIGNED,
  BookingStatus.ON_THE_WAY,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
];

const minutes = (n: number) => n * 60_000;
const pick = <T>(arr: readonly T[]): T => faker.helpers.arrayElement(arr as T[]);

/**
 * Picks a creation timestamp inside the history window, biased toward recent
 * days (a growing business) and away from Sundays (a closed-ish workshop).
 */
function pickCreatedAt(now: Date): Date {
  for (let attempt = 0; attempt < 12; attempt++) {
    // 1 - sqrt(u) gives a linearly rising volume toward today: roughly twice the
    // mean daily rate now versus the start of the window. A steeper curve (such
    // as squaring) piles ~13% of all bookings onto today alone, which reads as a
    // data-generation artifact rather than a growing business.
    const daysAgo = Math.floor(
      (1 - Math.sqrt(faker.number.float({ min: 0, max: 1 }))) * DAYS_OF_HISTORY,
    );
    const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    // Workshop hours, 8am-7pm. setHours is local time, so on the current day
    // this can easily land after "now" — a booking dated in the future would
    // show up on the board as work that has not happened yet.
    d.setHours(faker.number.int({ min: 8, max: 19 }), faker.number.int({ min: 0, max: 59 }), 0, 0);
    if (d.getTime() > now.getTime()) continue;
    const isSunday = d.getDay() === 0;
    if (isSunday && faker.number.float({ min: 0, max: 1 }) > 0.25) continue;
    return d;
  }
  // Fallback for the retry budget running out (e.g. seeding early in the
  // morning, when little of today is in the past yet).
  return new Date(now.getTime() - faker.number.int({ min: 15, max: 240 }) * 60_000);
}

/**
 * Decides the current status. Age is the deciding factor: anything older than
 * ~2 days has finished one way or another, so the live board only ever shows
 * in-flight work that could genuinely still be in flight.
 */
function pickStatus(createdAt: Date, now: Date): BookingStatus {
  const ageHours = (now.getTime() - createdAt.getTime()) / 3_600_000;
  const roll = faker.number.float({ min: 0, max: 1 });

  if (ageHours > 48) return roll < 0.9 ? BookingStatus.COMPLETED : BookingStatus.CANCELLED;
  if (ageHours > 8) {
    if (roll < 0.72) return BookingStatus.COMPLETED;
    if (roll < 0.82) return BookingStatus.CANCELLED;
    return BookingStatus.IN_PROGRESS;
  }
  // Fresh work: spread across the live pipeline.
  if (roll < 0.22) return BookingStatus.PENDING;
  if (roll < 0.42) return BookingStatus.ASSIGNED;
  if (roll < 0.6) return BookingStatus.ON_THE_WAY;
  if (roll < 0.8) return BookingStatus.IN_PROGRESS;
  if (roll < 0.94) return BookingStatus.COMPLETED;
  return BookingStatus.CANCELLED;
}

type SeedEvent = {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  note: string | null;
  actor: string;
  createdAt: Date;
};

/**
 * Builds the transition chain that produced `status`, with plausible gaps.
 *
 * Every timestamp is clamped to `now`: the gaps add up to as much as four hours,
 * so a booking created an hour ago would otherwise be "completed" in the future.
 * Clamping can collapse the last few steps onto the same instant, which reads
 * correctly — the job just moved quickly.
 */
function buildEvents(
  bookingId: string,
  status: BookingStatus,
  createdAt: Date,
  now: Date,
): SeedEvent[] {
  const events: SeedEvent[] = [];
  const clamp = (d: Date) => new Date(Math.min(d.getTime(), now.getTime()));

  const push = (from: BookingStatus | null, to: BookingStatus, at: Date, note?: string) =>
    events.push({
      id: randomUUID(),
      bookingId,
      fromStatus: from,
      toStatus: to,
      note: note ?? null,
      actor: 'system',
      createdAt: clamp(at),
    });

  push(null, BookingStatus.PENDING, createdAt, 'Booking created');

  const stepGaps = [
    minutes(faker.number.int({ min: 2, max: 15 })),
    minutes(faker.number.int({ min: 5, max: 30 })),
    minutes(faker.number.int({ min: 10, max: 40 })),
    minutes(faker.number.int({ min: 30, max: 180 })),
  ];

  if (status === BookingStatus.CANCELLED) {
    // Cancellations happen early — while pending, or shortly after assignment.
    const cancelAfterAssign = faker.number.float({ min: 0, max: 1 }) < 0.4;
    let at = createdAt;
    let from: BookingStatus = BookingStatus.PENDING;
    if (cancelAfterAssign) {
      at = new Date(at.getTime() + stepGaps[0]);
      push(BookingStatus.PENDING, BookingStatus.ASSIGNED, at);
      from = BookingStatus.ASSIGNED;
    }
    at = new Date(at.getTime() + minutes(faker.number.int({ min: 5, max: 120 })));
    push(
      from,
      BookingStatus.CANCELLED,
      at,
      pick(['Cancelled by customer', 'No mechanic available', 'Customer rescheduled']),
    );
    return events;
  }

  const target = FLOW.indexOf(status);
  let at = createdAt;
  for (let i = 1; i <= target; i++) {
    at = new Date(at.getTime() + stepGaps[i - 1]);
    push(FLOW[i - 1], FLOW[i], at);
  }
  return events;
}

async function main() {
  const now = new Date();
  console.log('Clearing existing data...');
  // Order matters: children before parents (FKs cascade, but be explicit).
  await prisma.bookingEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.mechanic.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  // --- Users ---------------------------------------------------------------
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.createMany({
    data: [
      { email: 'admin@pitstop.dev', name: 'Aarti Deshpande', role: Role.ADMIN, passwordHash },
      { email: 'ops@pitstop.dev', name: 'Rohan Iyer', role: Role.OPS, passwordHash },
    ],
  });

  // --- Services ------------------------------------------------------------
  const services = SERVICES.map((s) => ({ id: randomUUID(), ...s }));
  await prisma.service.createMany({ data: services });

  // --- Mechanics -----------------------------------------------------------
  const mechanics = Array.from({ length: COUNTS.mechanics }, () => {
    const city = pick(CITIES);
    return {
      id: randomUUID(),
      name: faker.person.fullName(),
      phone: faker.phone.number({ style: 'national' }),
      specialization: pick(SPECIALIZATIONS),
      status: MechanicStatus.AVAILABLE,
      rating: Number(faker.number.float({ min: 3.6, max: 5, fractionDigits: 1 }).toFixed(1)),
      jobsCompleted: 0,
      city: city.name,
      // Scatter mechanics a few km around their city centre.
      lat: city.lat + faker.number.float({ min: -0.08, max: 0.08 }),
      lng: city.lng + faker.number.float({ min: -0.08, max: 0.08 }),
      hiredAt: faker.date.past({ years: 4 }),
    };
  });
  await prisma.mechanic.createMany({ data: mechanics });

  // --- Customers + vehicles ------------------------------------------------
  const customers = Array.from({ length: COUNTS.customers }, (_, i) => {
    const city = pick(CITIES);
    const name = faker.person.fullName();
    return {
      id: randomUUID(),
      name,
      // Index-suffixed so the unique constraint can never collide.
      email: `${faker.internet
        .username({ firstName: name.split(' ')[0] })
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')}${i}@example.com`,
      phone: faker.phone.number({ style: 'national' }),
      city: city.name,
      createdAt: faker.date.past({ years: 2 }),
    };
  });
  await prisma.customer.createMany({ data: customers });

  const usedPlates = new Set<string>();
  const vehicles = customers.flatMap((c) => {
    const cityPlate = CITIES.find((x) => x.name === c.city)!.plate;
    const count = faker.number.int({ min: 1, max: 2 });
    return Array.from({ length: count }, () => {
      const brand = pick(VEHICLES);
      let regNo: string;
      do {
        regNo = `${cityPlate}${faker.number
          .int({ min: 1, max: 59 })
          .toString()
          .padStart(2, '0')}${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.number.int({ min: 1000, max: 9999 })}`;
      } while (usedPlates.has(regNo));
      usedPlates.add(regNo);
      return {
        id: randomUUID(),
        customerId: c.id,
        make: brand.make,
        model: pick(brand.models),
        year: faker.number.int({ min: 2014, max: 2025 }),
        regNo,
        fuelType: faker.helpers.weightedArrayElement([
          { weight: 55, value: FuelType.PETROL },
          { weight: 28, value: FuelType.DIESEL },
          { weight: 7, value: FuelType.CNG },
          { weight: 6, value: FuelType.ELECTRIC },
          { weight: 4, value: FuelType.HYBRID },
        ]),
      };
    });
  });
  await prisma.vehicle.createMany({ data: vehicles });

  // --- Bookings + events ---------------------------------------------------
  const bookingRows: any[] = [];
  const eventRows: SeedEvent[] = [];
  const completedByMechanic = new Map<string, number>();
  const busyMechanics = new Set<string>();

  const drafts = Array.from({ length: COUNTS.bookings }, () => {
    const createdAt = pickCreatedAt(now);
    return { createdAt, status: pickStatus(createdAt, now) };
  })
    // Sort oldest-first so booking codes run in chronological order, the way a
    // real sequence would.
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  drafts.forEach((draft, i) => {
    const { createdAt } = draft;
    let status = draft.status;
    const customer = pick(customers);
    const customerVehicles = vehicles.filter((v) => v.customerId === customer.id);
    const vehicle = pick(customerVehicles);
    const service = pick(services);
    const id = randomUUID();

    // Everything past PENDING has a mechanic on it.
    const needsMechanic = status !== BookingStatus.PENDING;
    const isInFlight =
      status === BookingStatus.ASSIGNED ||
      status === BookingStatus.ON_THE_WAY ||
      status === BookingStatus.IN_PROGRESS;

    // Prefer a mechanic in the same city — dispatch would not send one cross-country.
    const localMechanics = mechanics.filter((m) => m.city === customer.city);
    const pool = localMechanics.length ? localMechanics : mechanics;

    let mechanic: (typeof mechanics)[number] | null = null;
    if (needsMechanic) {
      // A mechanic can only be on one job at a time. Without this the 60-odd
      // in-flight bookings spread over 25 mechanics leave every single one
      // marked ON_JOB, and "active mechanics" becomes a constant.
      const candidates = isInFlight ? pool.filter((m) => !busyMechanics.has(m.id)) : pool;
      if (isInFlight && candidates.length === 0) {
        // Nobody free to take it — which is exactly what an unassigned backlog
        // looks like in a real operation.
        status = BookingStatus.PENDING;
      } else {
        mechanic = pick(candidates.length ? candidates : pool);
      }
    }

    const events = buildEvents(id, status, createdAt, now);
    const lastAt = events[events.length - 1].createdAt;

    if (mechanic) {
      if (status === BookingStatus.COMPLETED) {
        completedByMechanic.set(mechanic.id, (completedByMechanic.get(mechanic.id) ?? 0) + 1);
      }
      // Anything mid-pipeline occupies its mechanic right now.
      if (
        status === BookingStatus.ASSIGNED ||
        status === BookingStatus.ON_THE_WAY ||
        status === BookingStatus.IN_PROGRESS
      ) {
        busyMechanics.add(mechanic.id);
      }
    }

    const variance = faker.number.float({ min: 0.85, max: 1.2 });
    const amount = Math.round((service.basePrice * variance) / 10) * 10;

    bookingRows.push({
      id,
      code: `BK-${createdAt.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: service.id,
      mechanicId: mechanic?.id ?? null,
      status,
      // Cancelled jobs are never invoiced.
      amount: status === BookingStatus.CANCELLED ? 0 : amount,
      city: customer.city,
      notes: faker.datatype.boolean({ probability: 0.25 })
        ? pick([
            'Customer reported unusual noise',
            'Pickup requested from office',
            'AC not cooling',
            'Warning light on dashboard',
          ])
        : null,
      scheduledAt: new Date(createdAt.getTime() + minutes(faker.number.int({ min: 30, max: 480 }))),
      createdAt,
      updatedAt: lastAt,
      completedAt: status === BookingStatus.COMPLETED ? lastAt : null,
    });
    eventRows.push(...events);
  });

  // Chunked because a single 700-row / 2500-row INSERT is a lot of parameters.
  for (let i = 0; i < bookingRows.length; i += 200) {
    await prisma.booking.createMany({ data: bookingRows.slice(i, i + 200) });
  }
  for (let i = 0; i < eventRows.length; i += 500) {
    await prisma.bookingEvent.createMany({ data: eventRows.slice(i, i + 500) });
  }

  // --- Reconcile mechanic rollups -----------------------------------------
  // jobsCompleted and status are derived, never invented.
  await Promise.all(
    mechanics.map((m) => {
      const isBusy = busyMechanics.has(m.id);
      const status = isBusy
        ? MechanicStatus.ON_JOB
        : faker.number.float({ min: 0, max: 1 }) < 0.18
          ? MechanicStatus.OFF_DUTY
          : MechanicStatus.AVAILABLE;
      return prisma.mechanic.update({
        where: { id: m.id },
        data: { jobsCompleted: completedByMechanic.get(m.id) ?? 0, status },
      });
    }),
  );

  const [b, c, mCount, v, e] = await Promise.all([
    prisma.booking.count(),
    prisma.customer.count(),
    prisma.mechanic.count(),
    prisma.vehicle.count(),
    prisma.bookingEvent.count(),
  ]);
  console.log(
    `Seeded: ${b} bookings, ${e} events, ${c} customers, ${v} vehicles, ${mCount} mechanics, ${services.length} services, 2 users`,
  );
  console.log('Login: admin@pitstop.dev / ops@pitstop.dev — password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
