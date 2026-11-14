import { Request, Response } from 'express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Qelem API (ቀለም)',
    version: '1.0.0',
    description:
      'Production RESTful API for Qelem — the devlog and learning-in-public platform for Ethiopian computer science students.',
    contact: {
      name: 'Adnan (Lead Engineer)',
      url: 'https://qelem.vercel.app',
      email: 'iam.professor.adnan@gmail.com'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base Endpoint'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '654321abcdef1234567890ab' },
          username: { type: 'string', example: 'aau_student' },
          displayName: { type: 'string', example: 'Adnan Dev' },
          email: { type: 'string', example: 'adnan@aau.edu.et' },
          university: { type: 'string', example: 'Addis Ababa University (AAU)' },
          isEmailVerified: { type: 'boolean', example: true },
          isPhoneVerified: { type: 'boolean', example: true }
        }
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          authorId: { type: 'string' },
          text: { type: 'string', example: 'Building distributed rate limiters in TypeScript!' },
          tags: { type: 'array', items: { type: 'string' }, example: ['typescript', 'redis'] },
          code: {
            type: 'object',
            properties: {
              lang: { type: 'string', example: 'typescript' },
              body: { type: 'string', example: 'const limit = 100;' }
            }
          },
          likeCount: { type: 'number', example: 14 },
          commentCount: { type: 'number', example: 3 }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Telemetry & Health Check',
        tags: ['Observability'],
        responses: {
          200: { description: 'All systems healthy (MongoDB, Redis, Memory)' },
          503: { description: 'Degraded connection' }
        }
      }
    },
    '/auth/demo-login': {
      post: {
        summary: '1-Click Demo Guest Login',
        description: 'Instant login as an AAU verified student guest account for reviewers.',
        tags: ['Authentication'],
        responses: {
          200: { description: 'Guest session created with JWT tokens' }
        }
      }
    },
    '/auth/register': {
      post: {
        summary: 'Register new student account',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'displayName', 'email', 'password'],
                properties: {
                  username: { type: 'string', example: 'abebe_cs' },
                  displayName: { type: 'string', example: 'Abebe Bikila' },
                  email: { type: 'string', example: 'abebe@aau.edu.et' },
                  password: { type: 'string', example: 'SecretP@ss123' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Account registered and verification email sent' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate existing user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['login', 'password'],
                properties: {
                  login: { type: 'string', example: 'abebe_cs' },
                  password: { type: 'string', example: 'SecretP@ss123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Successful login with token pair' }
        }
      }
    },
    '/posts': {
      get: {
        summary: 'List recent devlogs (explore feed)',
        tags: ['Devlogs'],
        responses: {
          200: { description: 'Paginated list of posts' }
        }
      },
      post: {
        summary: 'Publish new devlog',
        tags: ['Devlogs'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Post published' }
        }
      }
    },
    '/feed': {
      get: {
        summary: 'Get personalized timeline feed (Hybrid Fan-Out)',
        tags: ['Feed'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Personalized timeline posts' }
        }
      }
    },
    '/payments/tip': {
      post: {
        summary: 'Tip a student author via Chapa (Telebirr/CBE Birr)',
        tags: ['Payments'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Chapa checkout session URL returned' }
        }
      }
    }
  }
};

export function renderSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Qelem API Documentation (ቀለም)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✒️</text></svg>">
  <style>
    body { margin: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .topbar { background-color: #1e293b !important; padding: 10px 0; }
    .topbar .download-url-wrapper { display: none !important; }
    .swagger-ui .info .title { color: #0f172a; font-size: 32px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api-docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}

export const swaggerController = {
  getDocs: (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderSwaggerHtml());
  },
  getSpec: (_req: Request, res: Response) => {
    res.json(openApiSpec);
  }
};
