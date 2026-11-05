import type { Express, Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

export interface RouteModule {
  prefix: string;
  router: Router;
  tag?: string;
  description?: string;
}

// Baseline comprehensive OpenAPI 3.0 specification
const baseOpenApiSpec: Record<string, any> = {
  openapi: '3.0.0',
  info: {
    title: 'Melosis CRM API Explorer',
    version: '1.0.0',
    description: `
**Melosis CRM API** provides enterprise relationship management for educational institutes, coaching centres, and colleges.

### Key Capabilities:
- **Authentication**: High-memory Argon2id hashed credentials, secure HttpOnly session cookies, and CSRF protection.
- **Pipeline & Leads**: Complete institute lifecycle tracking from Cold Calling to Onboarding, with live search, tags, and duplicate detection.
- **Archive Vault**: Soft-archiving with full restoration and permanent delete controls.
- **Follow-up Tasks & Queue**: Daily calling queues, automated completion logs, and scheduled follow-up reminders.
- **Import / Export**: High-volume CSV importing with phone normalization and duplicate prevention.
- **User Management**: RBAC (SUPERADMIN / USER) with session deactivation upon deletion.

*All endpoints under \`/api/v1\` (except \`/auth/login\`) require an authenticated session cookie (\`melosis_session\`). State-modifying endpoints (POST, PATCH, DELETE) also require an \`X-CSRF-Token\` header.*
    `,
    contact: {
      name: 'Melosis CRM Engineering Team',
      email: 'engineering@melosis.com',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 (Primary)',
    },
    {
      url: '/',
      description: 'Host Root Server',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication, session status, CSRF tokens, and credentials' },
    { name: 'Dashboard', description: 'Pipeline metrics, follow-up queues, and team activities' },
    { name: 'Leads', description: 'Institute relationship management, lifecycle, notes, and activity history' },
    { name: 'Tasks', description: 'Scheduled follow-ups, calls, reminders, and outcome resolution' },
    { name: 'Import / Export', description: 'Bulk CSV lead ingestion, preview validation, and full data export' },
    { name: 'Users', description: 'Team management and role permissions (Superadmin only)' },
    { name: 'System', description: 'Service health check and infrastructure status' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'melosis_session',
        description: 'Session cookie set automatically by POST /auth/login.',
      },
      csrfToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description: 'CSRF token required for state-changing requests (POST, PATCH, DELETE). Obtained from GET /auth/csrf.',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully.' },
          data: { type: 'object' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Detailed error message' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'usr_cm84abc123' },
          name: { type: 'string', example: 'Priya Sharma' },
          email: { type: 'string', format: 'email', example: 'priya@melosis.com' },
          role: { type: 'string', enum: ['SUPERADMIN', 'USER'], example: 'SUPERADMIN' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Lead: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'lead_cm84abc123' },
          instituteName: { type: 'string', example: 'Alpha IIT-JEE Academy' },
          ownerName: { type: 'string', nullable: true, example: 'Rajesh Verma' },
          mobileNumber: { type: 'string', example: '+91 98765 43210' },
          normalizedMobileNumber: { type: 'string', example: '9876543210' },
          email: { type: 'string', format: 'email', nullable: true, example: 'contact@alphaiit.com' },
          location: { type: 'string', nullable: true, example: 'Kota, Rajasthan' },
          instituteType: {
            type: 'string',
            enum: ['COACHING_CENTRE', 'COMPUTER_INSTITUTE', 'COLLEGE', 'SCHOOL', 'OTHER'],
            example: 'COACHING_CENTRE',
          },
          source: {
            type: 'string',
            enum: ['COLD_CALLING', 'REFERRAL', 'WHATSAPP', 'WEBSITE', 'LINKEDIN', 'WALK_IN', 'OTHER'],
            example: 'COLD_CALLING',
          },
          status: {
            type: 'string',
            enum: ['NEW', 'CONTACTED', 'INTERESTED', 'DEMO_SCHEDULED', 'PILOT', 'CUSTOMER', 'NOT_INTERESTED', 'LOST'],
            example: 'INTERESTED',
          },
          onboardingStatus: {
            type: 'string',
            enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
            example: 'IN_PROGRESS',
          },
          remarks: { type: 'string', nullable: true, example: 'Decision maker requested product demo on Thursday.' },
          customerNotes: { type: 'string', nullable: true },
          hasBeenCalled: { type: 'boolean', example: true },
          nextFollowUp: { type: 'string', format: 'date-time', nullable: true },
          archivedAt: { type: 'string', format: 'date-time', nullable: true },
          convertedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateLeadInput: {
        type: 'object',
        required: ['instituteName', 'mobileNumber'],
        properties: {
          instituteName: { type: 'string', minLength: 1, maxLength: 180, example: 'Apex Coaching' },
          ownerName: { type: 'string', maxLength: 160, nullable: true, example: 'Sunil Kumar' },
          mobileNumber: { type: 'string', minLength: 5, maxLength: 40, example: '9876543210' },
          email: { type: 'string', format: 'email', nullable: true, example: 'info@apex.edu' },
          location: { type: 'string', maxLength: 180, nullable: true, example: 'Jaipur' },
          instituteType: {
            type: 'string',
            enum: ['COACHING_CENTRE', 'COMPUTER_INSTITUTE', 'COLLEGE', 'SCHOOL', 'OTHER'],
            default: 'OTHER',
          },
          source: {
            type: 'string',
            enum: ['COLD_CALLING', 'REFERRAL', 'WHATSAPP', 'WEBSITE', 'LINKEDIN', 'WALK_IN', 'OTHER'],
            default: 'OTHER',
          },
          remarks: { type: 'string', maxLength: 10000, nullable: true },
          hasBeenCalled: { type: 'boolean', default: false },
          onboardingStatus: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] },
          customerNotes: { type: 'string', maxLength: 10000, nullable: true },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tsk_cm84abc123' },
          title: { type: 'string', example: 'Product Walkthrough Demo' },
          description: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['FOLLOW_UP', 'DEMO', 'ONBOARDING', 'OTHER'], example: 'DEMO' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'HIGH' },
          status: { type: 'string', enum: ['OPEN', 'COMPLETED', 'CANCELLED'], example: 'OPEN' },
          dueAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          leadId: { type: 'string', example: 'lead_cm84abc123' },
          lead: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              instituteName: { type: 'string' },
              mobileNumber: { type: 'string' },
              ownerName: { type: 'string', nullable: true },
              status: { type: 'string' },
            },
          },
        },
      },
      CreateTaskInput: {
        type: 'object',
        required: ['title', 'leadId', 'dueAt'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 180, example: 'Follow up on proposal' },
          description: { type: 'string', maxLength: 10000, nullable: true },
          leadId: { type: 'string', example: 'lead_cm84abc123' },
          type: { type: 'string', enum: ['FOLLOW_UP', 'DEMO', 'ONBOARDING', 'OTHER'], default: 'FOLLOW_UP' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
          status: { type: 'string', enum: ['OPEN', 'COMPLETED', 'CANCELLED'], default: 'OPEN' },
          dueAt: { type: 'string', format: 'date-time' },
        },
      },
      Activity: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'act_cm84abc123' },
          leadId: { type: 'string' },
          userId: { type: 'string' },
          type: { type: 'string', enum: ['CALL', 'WHATSAPP', 'EMAIL', 'DEMO', 'MEETING', 'NOTE', 'OTHER'], example: 'CALL' },
          outcome: {
            type: 'string',
            enum: ['NO_ANSWER', 'SPOKE_SUCCESSFULLY', 'INTERESTED', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'OTHER'],
            nullable: true,
          },
          notes: { type: 'string', nullable: true },
          occurredAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Admin User' },
            },
          },
        },
      },
      CreateActivityInput: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['CALL', 'WHATSAPP', 'EMAIL', 'DEMO', 'MEETING', 'NOTE', 'OTHER'], example: 'CALL' },
          outcome: {
            type: 'string',
            enum: ['NO_ANSWER', 'SPOKE_SUCCESSFULLY', 'INTERESTED', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'OTHER'],
            nullable: true,
          },
          notes: { type: 'string', maxLength: 10000, nullable: true },
          occurredAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User Sign In',
        description: 'Authenticates with email and password. Sets an encrypted HttpOnly session cookie (\`melosis_session\`). Rate-limited to 10 requests per 15 minutes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@melosis.com' },
                  password: { type: 'string', minLength: 1, example: 'AdminSecure#2026' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successfully authenticated',
            headers: {
              'Set-Cookie': {
                description: 'melosis_session HttpOnly cookie',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                    message: { type: 'string', example: 'Signed in.' },
                  },
                },
              },
            },
          },
          401: { description: 'Email or password is incorrect' },
          429: { description: 'Too many sign-in attempts' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'User Sign Out',
        description: 'Destroys current session in database and clears the \`melosis_session\` cookie.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        responses: {
          200: { description: 'Signed out successfully' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get Current Authenticated User',
        description: 'Returns identity and role of currently signed-in user.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'Current user session profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/csrf': {
      get: {
        tags: ['Auth'],
        summary: 'Issue CSRF Token',
        description: 'Returns an anti-forgery CSRF token required for subsequent POST, PATCH, and DELETE requests in the \`X-CSRF-Token\` header.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'CSRF token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    csrfToken: { type: 'string', example: '05b76e22d34e4b484e84f17d3a2f3b616f...' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change User Password',
        description: 'Verifies current password and updates with new password hashed with Argon2id. Revokes all active sessions.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', minLength: 1 },
                  newPassword: { type: 'string', minLength: 12, example: 'SuperSecurePass2026!' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password changed successfully' },
          400: { description: 'Current password is incorrect or new password validation failed' },
        },
      },
    },
    '/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Dashboard Metric Summary',
        description: 'Provides KPI totals (leads, contacted, interested, demos, pilots, customers, overdue tasks) and stage breakdown.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'Summary metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        totalLeads: { type: 'integer', example: 142 },
                        newLeads: { type: 'integer', example: 45 },
                        contactedLeads: { type: 'integer', example: 38 },
                        interestedInstitutes: { type: 'integer', example: 21 },
                        demosScheduled: { type: 'integer', example: 12 },
                        inPilot: { type: 'integer', example: 8 },
                        customers: { type: 'integer', example: 18 },
                        overdueFollowUps: { type: 'integer', example: 3 },
                        pipeline: {
                          type: 'object',
                          additionalProperties: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/dashboard/follow-ups': {
      get: {
        tags: ['Dashboard'],
        summary: 'Follow-ups Queue',
        description: 'Retrieves categorized open follow-ups: today, overdue, and upcoming.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'Categorized follow-ups queue',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        today: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                        overdue: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                        upcoming: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/dashboard/recent-activities': {
      get: {
        tags: ['Dashboard'],
        summary: 'Recent Activity Feed',
        description: 'Returns the 12 most recent logged activities across all leads.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'List of recent activities',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Activity' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/leads': {
      get: {
        tags: ['Leads'],
        summary: 'List & Search Leads',
        description: 'Query active or archived leads with full text search, pagination, status filtering, and live directory counts.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 500 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Searches instituteName, ownerName, mobileNumber, location' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['NEW', 'CONTACTED', 'INTERESTED', 'DEMO_SCHEDULED', 'PILOT', 'CUSTOMER', 'NOT_INTERESTED', 'LOST'] } },
          { name: 'instituteType', in: 'query', schema: { type: 'string', enum: ['COACHING_CENTRE', 'COMPUTER_INSTITUTE', 'COLLEGE', 'SCHOOL', 'OTHER'] } },
          { name: 'source', in: 'query', schema: { type: 'string', enum: ['COLD_CALLING', 'REFERRAL', 'WHATSAPP', 'WEBSITE', 'LINKEDIN', 'WALK_IN', 'OTHER'] } },
          { name: 'called', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'archived', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'If true, fetches archived leads vault' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          200: {
            description: 'Paginated lead items with active & archived counts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Lead' } },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            total: { type: 'integer' },
                            totalPages: { type: 'integer' },
                          },
                        },
                        counts: {
                          type: 'object',
                          properties: {
                            active: { type: 'integer', example: 120 },
                            archived: { type: 'integer', example: 14 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Leads'],
        summary: 'Create Lead',
        description: 'Creates a new institute lead, normalizes mobile phone, checks for duplicates, and records creation activity.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLeadInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Lead created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        lead: { $ref: '#/components/schemas/Lead' },
                        duplicateWarning: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error or invalid mobile number' },
        },
      },
    },
    '/leads/assign': {
      post: {
        tags: ['Leads'],
        summary: 'Assign Leads in Bulk (Superadmin)',
        description: 'Assigns or reassigns one or multiple leads to a team user, recording assignment history and activity logs.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leadIds'],
                properties: {
                  leadIds: { type: 'array', items: { type: 'string' }, example: ['cuid_1', 'cuid_2'] },
                  assignedToUserId: { type: 'string', nullable: true, example: 'cuid_user_123' },
                  notes: { type: 'string', maxLength: 255, example: 'Assigned for Q4 outreach' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Leads assigned successfully' },
          403: { description: 'Forbidden (Requires Superadmin role)' },
        },
      },
    },
    '/leads/assignment-history': {
      get: {
        tags: ['Leads'],
        summary: 'Get Lead Assignment History (Superadmin)',
        description: 'Returns chronological audit trail of all lead assignments with previous user, new assignee, and assigned-by admin.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'leadId', in: 'query', schema: { type: 'string' } },
          { name: 'userId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Assignment history logs' },
          403: { description: 'Forbidden (Requires Superadmin role)' },
        },
      },
    },
    '/leads/assignment-stats': {
      get: {
        tags: ['Leads'],
        summary: 'Get Lead Assignment Stats (Superadmin)',
        description: 'Returns breakdown of total, assigned, and unassigned leads, plus per-user lead counts.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Assignment statistics' },
          403: { description: 'Forbidden (Requires Superadmin role)' },
        },
      },
    },
    '/leads/{id}': {
      get: {
        tags: ['Leads'],
        summary: 'Get Lead Profile',
        description: 'Retrieves full lead details including next follow-up task timestamp. Works for both active and archived leads.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Lead details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Lead' },
                  },
                },
              },
            },
          },
          404: { description: 'Lead not found' },
        },
      },
      patch: {
        tags: ['Leads'],
        summary: 'Update Lead Information',
        description: 'Updates partial fields of an active lead (phone, name, email, remarks, notes, etc.).',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLeadInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated lead',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        lead: { $ref: '#/components/schemas/Lead' },
                        duplicateWarning: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Lead not found' },
        },
      },
      delete: {
        tags: ['Leads'],
        summary: 'Permanently Delete Lead',
        description: 'Permanently removes a lead and cascades deletion to all associated tasks and activities.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lead permanently deleted' },
          404: { description: 'Lead not found' },
        },
      },
    },
    '/leads/{id}/archive': {
      post: {
        tags: ['Leads'],
        summary: 'Archive Lead',
        description: 'Moves lead to the Archived Leads vault by stamping \`archivedAt\`. Hides it from active views.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lead archived successfully' },
          404: { description: 'Lead not found' },
        },
      },
    },
    '/leads/{id}/restore': {
      post: {
        tags: ['Leads'],
        summary: 'Restore Archived Lead',
        description: 'Restores an archived lead back into the active directory (\`archivedAt: null\`) and logs an activity.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lead restored to active directory' },
          404: { description: 'Archived lead not found' },
        },
      },
    },
    '/leads/{id}/status': {
      patch: {
        tags: ['Leads'],
        summary: 'Update Lead Pipeline Stage',
        description: 'Transitions lead status (NEW, CONTACTED, INTERESTED, DEMO_SCHEDULED, PILOT, CUSTOMER) and logs timeline audit.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['NEW', 'CONTACTED', 'INTERESTED', 'DEMO_SCHEDULED', 'PILOT', 'CUSTOMER', 'NOT_INTERESTED', 'LOST'],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
          404: { description: 'Lead not found' },
        },
      },
    },
    '/leads/{id}/activities': {
      get: {
        tags: ['Leads'],
        summary: 'List Lead Activities',
        description: 'Retrieves chronological interaction timeline for a specific lead.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Activity timeline',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Activity' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Leads'],
        summary: 'Log Lead Activity',
        description: 'Records an interaction (CALL, NOTE, MEETING, DEMO, WHATSAPP) with outcome and notes. Automatically marks \`hasBeenCalled: true\` if type is CALL.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateActivityInput' },
            },
          },
        },
        responses: {
          201: { description: 'Activity logged' },
          404: { description: 'Lead not found' },
        },
      },
    },
    '/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List Follow-up Tasks',
        description: 'Fetches open, completed, or cancelled follow-ups, with priority and lead filters.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'COMPLETED', 'CANCELLED'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] } },
          { name: 'leadId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of tasks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Schedule Follow-up Task',
        description: 'Creates a follow-up, demo, or onboarding reminder assigned to a lead.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTaskInput' },
            },
          },
        },
        responses: {
          201: { description: 'Task scheduled' },
          404: { description: 'Lead not found' },
        },
      },
    },
    '/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get Task Details',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Task details' },
          404: { description: 'Task not found' },
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update Task',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                  dueAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Task updated' },
          404: { description: 'Task not found' },
        },
      },
    },
    '/tasks/{id}/complete': {
      patch: {
        tags: ['Tasks'],
        summary: 'Complete Task with Outcome',
        description: 'Marks task as COMPLETED, records completion timestamp, and automatically logs an Activity note with outcome.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  outcome: {
                    type: 'string',
                    enum: ['NO_ANSWER', 'SPOKE_SUCCESSFULLY', 'INTERESTED', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'OTHER'],
                  },
                  notes: { type: 'string', maxLength: 10000 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Task completed' },
          409: { description: 'Task is not open' },
        },
      },
    },
    '/tasks/{id}/cancel': {
      patch: {
        tags: ['Tasks'],
        summary: 'Cancel Task',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Task cancelled' },
          404: { description: 'Open task not found' },
        },
      },
    },
    '/leads/import/preview': {
      post: {
        tags: ['Import / Export'],
        summary: 'Preview CSV Import & Detect Duplicates',
        description: 'Parses raw CSV content, checks rows against validation schemas, and flags duplicate mobile numbers in the database and current file.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['csv'],
                properties: {
                  csv: { type: 'string', example: 'Institute Name,Mobile Number\\nAlpha Coaching,9876543210' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Validation preview with valid and invalid rows',
          },
          400: { description: 'Invalid CSV format or missing headers' },
        },
      },
    },
    '/leads/import/confirm': {
      post: {
        tags: ['Import / Export'],
        summary: 'Confirm & Execute Bulk CSV Import',
        description: 'Inserts valid leads into database inside transactions, optionally skipping duplicate numbers.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['csv'],
                properties: {
                  csv: { type: 'string' },
                  skipDuplicates: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Import statistics (imported, skipped, failed)',
          },
        },
      },
    },
    '/leads/export': {
      get: {
        tags: ['Import / Export'],
        summary: 'Export Leads to CSV',
        description: 'Generates and downloads full UTF-8 CSV containing all active institute leads with sanitized values.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'CSV file download',
            content: {
              'text/csv': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List Team Users (Superadmin)',
        description: 'Lists all active team members with roles. Restricted to SUPERADMIN.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'List of users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden (Requires Superadmin role)' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create Staff Account (Superadmin)',
        description: 'Provisions a new staff account with USER role and high-memory Argon2id password hash.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 120, example: 'Rohan Mehta' },
                  email: { type: 'string', format: 'email', example: 'rohan@melosis.com' },
                  password: { type: 'string', minLength: 12, maxLength: 200, example: 'RohanSecure#2026' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User account created' },
          400: { description: 'Validation failed or duplicate email' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/users/{id}': {
      delete: {
        tags: ['Users'],
        summary: 'Deactivate User Account (Superadmin)',
        description: 'Deactivates a user and invalidates all their active sessions. Prevents deleting your own account or the last superadmin.',
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User account deactivated' },
          400: { description: 'Cannot delete own account' },
          409: { description: 'Cannot delete the last active superadmin' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Service Health Check',
        description: 'Public health endpoint to verify service uptime.',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Automatically inspects registered Express routers and merges any newly added endpoints
 * so future routes will automatically appear in Swagger without manual edits!
 */
export function autoDiscoverExpressRoutes(
  subRouters: RouteModule[],
  spec: Record<string, any>
): void {
  for (const mod of subRouters) {
    const basePrefix = mod.prefix === '/' ? '' : mod.prefix;
    const tag = mod.tag || (basePrefix.replace(/^\//, '') ? capitalize(basePrefix.replace(/^\//, '')) : 'General');

    for (const layer of mod.router.stack || []) {
      if (layer.route && layer.route.path) {
        const rawPath = layer.route.path;
        // Normalize path: e.g. /leads/export or /:id/restore
        const fullPath = (basePrefix + (rawPath === '/' ? '' : rawPath)) || '/';
        const openApiPath = fullPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        const methods = Object.keys((layer.route as any).methods || {});

        for (const method of methods) {
          const m = method.toLowerCase();
          if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(m)) continue;
          if (m === 'options' || m === 'head') continue;

          // Check if path & method already documented in spec
          if (!spec.paths[openApiPath]) {
            spec.paths[openApiPath] = {};
          }

          if (!spec.paths[openApiPath][m]) {
            // Automatically synthesize documentation for this newly detected route!
            const pathParams = (openApiPath.match(/\{([a-zA-Z0-9_]+)\}/g) || []).map(p => p.slice(1, -1));
            const segments = openApiPath.split('/').filter(Boolean);
            const lastSegment = segments[segments.length - 1] || '';
            const actionName = `${m.toUpperCase()} ${openApiPath}`;

            spec.paths[openApiPath][m] = {
              tags: [tag],
              summary: `${capitalize(m)} ${lastSegment.replace(/\{.*\}/, '') || 'Resource'} (Auto-detected)`,
              description: `Automatically registered endpoint: \`${m.toUpperCase()} ${fullPath}\`. You can enrich this endpoint with JSDoc @openapi annotations.`,
              security: openApiPath.startsWith('/auth/login') ? [] : [{ cookieAuth: [] }],
              parameters: pathParams.map(param => ({
                name: param,
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: `Identifier for ${param}`,
              })),
              ...(m === 'post' || m === 'patch' || m === 'put' ? {
                requestBody: {
                  description: 'Request payload',
                  required: false,
                  content: {
                    'application/json': {
                      schema: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              } : {}),
              responses: {
                200: { description: 'Successful operation' },
                400: { description: 'Bad Request / Validation error' },
                401: { description: 'Unauthorized' },
                500: { description: 'Internal Server Error' },
              },
            };
          }
        }
      }
    }
  }
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Builds the complete OpenAPI 3.0 specification by merging:
 * 1. Base curated specification
 * 2. Any JSDoc comments (@openapi or @swagger) found in controller/route files
 * 3. Dynamic runtime Express route discovery
 */
export function buildOpenApiSpec(subRouters: RouteModule[] = []): Record<string, any> {
  // 1. Run swagger-jsdoc to pick up any future JSDoc annotations
  const jsdocOptions: swaggerJsdoc.Options = {
    definition: {
      openapi: '3.0.0',
      info: baseOpenApiSpec.info,
      servers: baseOpenApiSpec.servers,
      components: baseOpenApiSpec.components,
      tags: baseOpenApiSpec.tags,
    },
    apis: [
      './src/routes/**/*.ts',
      './src/controllers/**/*.ts',
      './src/app.ts',
    ],
  };

  let generatedSpec: Record<string, any> = {};
  try {
    generatedSpec = swaggerJsdoc(jsdocOptions) as Record<string, any>;
  } catch (err) {
    console.warn('[Swagger] JSDoc parsing warning:', err);
  }

  // 2. Clone base curated specification
  const mergedSpec = JSON.parse(JSON.stringify(baseOpenApiSpec));

  // 3. Merge JSDoc paths if any exist
  if (generatedSpec.paths) {
    for (const [pathKey, pathItem] of Object.entries(generatedSpec.paths)) {
      mergedSpec.paths[pathKey] = {
        ...(mergedSpec.paths[pathKey] || {}),
        ...(pathItem as Record<string, any>),
      };
    }
  }

  // 4. Auto-discover all mounted routes
  autoDiscoverExpressRoutes(subRouters, mergedSpec);

  return mergedSpec;
}

/**
 * Sets up Swagger UI and JSON documentation endpoints on the Express app.
 */
export function setupSwagger(app: Express, subRouters: RouteModule[]): void {
  // Custom styled CSS matching Melosis CRM aesthetics
  const customCss = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fafbfc; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { max-width: 1380px; margin: 0 auto; padding: 24px 20px 80px; }
    .swagger-ui .info { margin: 20px 0 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; }
    .swagger-ui .info .title { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .swagger-ui .info .description { color: #334155; line-height: 1.6; }
    .swagger-ui .info .description h3 { margin-top: 18px; font-size: 16px; font-weight: 700; color: #1e293b; }
    .swagger-ui .opblock.opblock-get { background: rgba(59, 130, 246, 0.05); border-color: #3b82f6; }
    .swagger-ui .opblock.opblock-post { background: rgba(16, 185, 129, 0.05); border-color: #10b981; }
    .swagger-ui .opblock.opblock-patch { background: rgba(245, 158, 11, 0.05); border-color: #f59e0b; }
    .swagger-ui .opblock.opblock-delete { background: rgba(239, 68, 68, 0.05); border-color: #ef4444; }
    .swagger-ui .opblock .opblock-summary { padding: 10px 16px; border-radius: 8px; }
    .swagger-ui .opblock { border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin: 0 0 14px; }
    .swagger-ui .btn.authorize { background: #2563eb; color: #fff; border-color: #2563eb; border-radius: 8px; font-weight: 600; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
    .swagger-header-badge { display: inline-flex; align-items: center; gap: 8px; background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
  `;

  // Serve OpenAPI JSON schema
  const getSpec = () => buildOpenApiSpec(subRouters);

  app.get(['/docs/json', '/api-docs/json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(getSpec());
  });

  // Initial specification build for static bundle initialization
  const initialSpec = getSpec();

  // Swagger UI Middleware
  const swaggerUiOpts: swaggerUi.SwaggerUiOptions = {
    customCss,
    customSiteTitle: 'Melosis CRM - API Explorer & Documentation',
    swaggerOptions: {
      url: '/docs/json',
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      tryItOutEnabled: true,
    },
  };

  // Mount at both /docs and /api-docs (swaggerUi handles trailing slashes automatically)
  app.use(
    '/docs',
    swaggerUi.serveFiles(initialSpec, swaggerUiOpts),
    swaggerUi.setup(initialSpec, swaggerUiOpts)
  );

  app.use(
    '/api-docs',
    swaggerUi.serveFiles(initialSpec, swaggerUiOpts),
    swaggerUi.setup(initialSpec, swaggerUiOpts)
  );
}
