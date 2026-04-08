const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
const currency = z.enum(['KES', 'USD', 'EUR', 'GBP']);
const passthroughObject = z.object({}).passthrough();

const moneyObject = z.object({
  amount: z.coerce.number().min(0),
  currency: currency.optional(),
});

const aiChatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
    context: z.record(z.any()).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const bookCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    author: z.string().min(1).max(200),
    genre: z.string().max(120).optional(),
    copies: z.coerce.number().int().min(0).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const idParamOnlySchema = z.object({
  body: passthroughObject,
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

const courseCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    instructor: z.string().max(200).optional(),
    price: moneyObject,
    students: z.array(objectId).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const productCreateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    price: moneyObject,
    seller: z.string().max(200).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    category: z.string().max(120).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const rideCreateSchema = z.object({
  body: z.object({
    from: z.string().min(1).max(200),
    to: z.string().min(1).max(200),
    driver: z.string().max(200).optional(),
    seats: z.coerce.number().int().min(0).optional(),
    price: moneyObject,
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const hostelCreateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    rooms: z.coerce.number().int().min(0).optional(),
    price: z.coerce.number().min(0),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const liveClassroomCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    subject: z.string().max(200).optional(),
    teacherIds: z.array(objectId).optional(),
    learnerIds: z.array(objectId).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    accessCode: z.string().max(120).optional().nullable(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const liveClassroomSessionCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    scheduledAt: z.string().min(1),
    durationMinutes: z.coerce.number().int().min(5).max(600).optional(),
    provider: z.enum(['jitsi', 'zoom', 'custom']).optional(),
  }),
  params: z.object({ classroomId: objectId }),
  query: passthroughObject,
});

const sessionIdParamSchema = z.object({
  body: passthroughObject,
  params: z.object({ sessionId: objectId }),
  query: passthroughObject,
});

const partnerOnboardSchema = z.object({
  body: z.object({
    businessType: z.enum(['cab', 'hotel', 'hostel', 'mixed']),
    businessName: z.string().min(1).max(200),
    registrationNumber: z.string().max(120).optional(),
    contactEmail: z.string().email(),
    contactPhone: z.string().min(5).max(40),
    city: z.string().max(120).optional(),
    address: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const partnerIdParamSchema = z.object({
  body: passthroughObject,
  params: z.object({ partnerId: objectId }),
  query: passthroughObject,
});

const cabVehicleCreateSchema = z.object({
  body: z.object({
    plateNumber: z.string().min(3).max(30),
    vehicleType: z.enum(['sedan', 'van', 'bus', 'motorbike', 'other']).optional(),
    seats: z.coerce.number().int().min(1).optional(),
    driverName: z.string().max(200).optional(),
    driverPhone: z.string().max(40).optional(),
    baseFare: z.coerce.number().min(0).optional(),
    farePerKm: z.coerce.number().min(0).optional(),
    currency: currency.optional(),
    status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  }),
  params: z.object({ partnerId: objectId }),
  query: passthroughObject,
});

const cabBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(['accepted', 'ongoing', 'completed', 'cancelled', 'rejected']),
    finalFare: z.coerce.number().min(0).optional(),
  }),
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

const accommodationCreateSchema = z.object({
  body: z.object({
    listingType: z.enum(['hotel', 'hostel']),
    name: z.string().min(1).max(200),
    location: z.string().min(1).max(300),
    roomType: z.string().max(120).optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    availableUnits: z.coerce.number().int().min(0).optional(),
    pricePerNight: z.coerce.number().min(0),
    currency: currency.optional(),
    amenities: z.array(z.string().max(120)).optional(),
    imageUrls: z.array(z.string().url()).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
  params: z.object({ partnerId: objectId }),
  query: passthroughObject,
});

const accommodationApplySchema = z.object({
  body: z.object({
    checkInDate: z.string().min(1),
    checkOutDate: z.string().min(1),
    occupants: z.coerce.number().int().min(1).optional(),
    notes: z.string().max(2000).optional(),
  }),
  params: z.object({ listingId: objectId }),
  query: passthroughObject,
});

const accommodationStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    reviewNotes: z.string().max(2000).optional(),
  }),
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

const pastPaperCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    institution: z.string().min(1).max(300),
    course: z.string().min(1).max(300),
    unitCode: z.string().max(120).optional(),
    subject: z.string().min(1).max(300),
    year: z.coerce.number().int().min(1990).max(2100),
    examType: z.enum(['cat', 'midterm', 'endterm', 'national', 'mock', 'other']).optional(),
    semester: z.string().max(100).optional(),
    level: z.string().max(100).optional(),
    tags: z.array(z.string().max(80)).optional(),
    fileUrl: z.string().url(),
    visibility: z.enum(['public', 'private']).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const pastPaperUploadSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    institution: z.string().min(1).max(300),
    course: z.string().min(1).max(300),
    unitCode: z.string().max(120).optional(),
    subject: z.string().min(1).max(300),
    year: z.coerce.number().int().min(1990).max(2100),
    examType: z.enum(['cat', 'midterm', 'endterm', 'national', 'mock', 'other']).optional(),
    semester: z.string().max(100).optional(),
    level: z.string().max(100).optional(),
    tags: z.array(z.string().max(80)).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    originalFileName: z.string().min(1).max(255),
    mimeType: z.string().max(120).optional(),
    contentBase64: z.string().min(10),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const pastPaperVerifySchema = z.object({
  body: passthroughObject,
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

const marketplaceUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).optional(),
    category: z.string().max(120).optional(),
    condition: z.string().max(100).optional(),
    price: z.coerce.number().min(0).optional(),
    currency: currency.optional(),
    imageUrls: z.array(z.string().url()).optional(),
    status: z.enum(['active', 'reserved', 'sold', 'inactive']).optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    tags: z.array(z.string().max(80)).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one update field is required'),
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

const queueReplaySchema = z.object({
  body: z.object({
    deadLetterJobId: z.string().min(1),
  }),
  params: z.object({
    name: z.enum(['settlement-generation', 'file-post-processing', 'notifications', 'retention-sweep']),
  }),
  query: passthroughObject,
});

const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const revokeAllSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: passthroughObject,
});

const userRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(200),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const userLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = {
  aiChatSchema,
  bookCreateSchema,
  idParamOnlySchema,
  courseCreateSchema,
  productCreateSchema,
  rideCreateSchema,
  hostelCreateSchema,
  liveClassroomCreateSchema,
  liveClassroomSessionCreateSchema,
  sessionIdParamSchema,
  partnerOnboardSchema,
  partnerIdParamSchema,
  cabVehicleCreateSchema,
  cabBookingStatusSchema,
  accommodationCreateSchema,
  accommodationApplySchema,
  accommodationStatusSchema,
  pastPaperCreateSchema,
  pastPaperUploadSchema,
  pastPaperVerifySchema,
  marketplaceUpdateSchema,
  queueReplaySchema,
  logoutSchema,
  revokeAllSchema,
  userRegisterSchema,
  userLoginSchema,
};
