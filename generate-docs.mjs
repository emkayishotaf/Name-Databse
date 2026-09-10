import { z } from 'zod';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi
} from '@asteasolutions/zod-to-openapi';
import * as yaml from 'yaml';
import * as fs from 'fs';

// 1. Extend standard Zod with the .openapi() helper method
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// 2. Define Security Schemes
registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'apikey',
  description: 'Supabase Public Anon Key'
});

registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Supabase Bearer Token'
});

// 3. Define Reusable Schemas (Single Source of Truth)
const NewCustomerInputSchema = registry.register(
  'NewCustomerInput',
  z.object({
    Name: z.string()
      .trim()
      .min(2, "Name must be at least 2 characters long.")
      .max(30, "Name cannot exceed 30 characters.")
      .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes.")
      .openapi({
        description: "Person's name (letters, spaces, hyphens, and apostrophes only).",
        example: "Kelvin"
      }),
    dob: z.string().optional().openapi({
      description: "Date of birth (YYYY-MM-DD).",
      example: "2000-05-15"
    }),
    role: z.enum([
      "Developer",
      "Designer",
      "Cyberpunk Nomad",
      "Gamer",
      "Data Scientist",
      "Tech Enthusiast"
    ]).default("Developer").openapi({
      description: "User role or archetype.",
      example: "Developer"
    })
  }).openapi('NewCustomerInput')
);

const CustomerEntrySchema = registry.register(
  'CustomerEntry',
  z.object({
    id: z.number().int().openapi({ description: 'Auto-increment primary key', example: 19 }),
    Name: z.string().openapi({ description: "Person's name", example: 'Kelvin' }),
    dob: z.string().nullable().optional().openapi({ description: 'Date of birth', example: '2000-05-15' }),
    role: z.string().optional().openapi({ description: 'User role', example: 'Developer' }),
    created_at: z.string().datetime().openapi({ description: 'Commit timestamp', example: '2026-09-04T10:43:25.000Z' })
  }).openapi('CustomerEntry')
);

const ApiErrorSchema = registry.register(
  'ApiError',
  z.object({
    message: z.string().openapi({ example: 'new row for relation "Customer Names" violates check constraint' })
  }).openapi('ApiError')
);

// 4. Register GET /Customer Names
registry.registerPath({
  method: 'get',
  path: '/Customer%20Names',
  summary: 'Get Recent Greeted Names',
  description: 'Retrieves a list of recently logged customer names ordered by creation date.',
  operationId: 'getRecentNames',
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  request: {
    query: z.object({
      select: z.string().optional().default('*').openapi({ description: 'Columns to select' }),
      order: z.string().optional().default('created_at.desc').openapi({ description: 'Ordering criteria' }),
      limit: z.coerce.number().optional().default(10).openapi({ description: 'Maximum rows to return' })
    })
  },
  responses: {
    200: {
      description: 'Successfully retrieved the list of names.',
      content: {
        'application/json': {
          schema: z.array(CustomerEntrySchema)
        }
      }
    },
    401: {
      description: 'Missing or invalid Supabase Anon Key.'
    }
  }
});

// 5. Register POST /Customer Names
registry.registerPath({
  method: 'post',
  path: '/Customer%20Names',
  summary: 'Insert a New Customer Name',
  description: 'Validates and writes a new visitor name into the database.',
  operationId: 'insertCustomerName',
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  request: {
    headers: z.object({
      Prefer: z.string().optional().default('return=representation').openapi({
        description: 'Instructs the server to return the newly inserted row.'
      })
    }),
    body: {
      content: {
        'application/json': {
          schema: z.array(NewCustomerInputSchema)
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Name created successfully.',
      content: {
        'application/json': {
          schema: z.array(CustomerEntrySchema)
        }
      }
    },
    400: {
      description: 'Bad Request (Failed database constraint or validation).',
      content: {
        'application/json': {
          schema: ApiErrorSchema
        }
      }
    },
    401: {
      description: 'Missing or invalid Supabase Anon Key.'
    }
  }
});

// 6. Generate the OpenAPI 3.1 Document
const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'AuraGreet Customer Names API',
    version: '1.0.0',
    description: 'REST API specification generated automatically from Zod schemas.'
  },
  servers: [
    {
      url: 'https://tibxvvjsgkyurxepdnsh.supabase.co/rest/v1',
      description: 'Supabase Cloud Production Server'
    }
  ]
});

// 7. Write to openapi.yaml
const yamlOutput = yaml.stringify(document);
fs.writeFileSync('openapi.yaml', yamlOutput, 'utf8');

console.log('✅ openapi.yaml successfully generated from Zod schemas!');
