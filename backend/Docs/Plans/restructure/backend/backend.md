# Backend Restructure Plan

## Current Issues
- Backend has too many top-level directories (15+) with unclear separation of concerns
- Services directory contains mixed concerns with large, unrelated files
- Routes and controllers are flat without grouping by domain
- Related functionality is scattered across multiple directories
- No clear distinction between domain logic, application services, and delivery mechanisms
- Difficult to locate all files related to a specific feature (e.g., MT5 functionality spread across services, routes, controllers, scripts)

## Proposed Structure
```
backend/
├── src/
│   ├── core/              # Core business logic, shared utilities, constants
│   │   ├── types/         # Shared TypeScript interfaces and types (used across features)
│   │   ├── utils/         # Utility functions (helpers, constants, formatters, validators, etc.)
│   │   ├── config/        # Configuration management (environment variables, app settings)
│   │   └── errors/        # Custom error classes and error handling utilities
│   │
│   ├── features/          # Feature-specific implementations (domain-driven)
│   │   ├── mt5/           # MT5 bridge, connectors, protocols, and MT5-specific logic
│   │   │   ├── mt5Bridge.ts           # Core MT5 connection and protocol handling
│   │   │   ├── mt5Types.ts            # MT5-specific TypeScript interfaces
│   │   │   ├── mt5Utils.ts            # MT5-specific utility functions
│   │   │   ├── mt5Constants.ts        # MT5-specific constants (symbols, timeframes, etc.)
│   │   │   └── __tests__/             # Unit tests for MT5 feature
│   │   │
│   │   ├── strategies/    # Strategy logic, backtesting, and strategy management
│   │   │   ├── strategyEngine.ts      # Core strategy execution logic
│   │   │   ├── strategyTypes.ts       # Strategy-related TypeScript interfaces
│   │   │   ├── backtester.ts          # Strategy backtesting implementation
│   │   │   ├── strategyValidator.ts   # Strategy validation logic
│   │   │   └── __tests__/             # Unit tests for strategies feature
│   │   │
│   │   ├── database/      # Database operations, models, and migrations
│   │   │   ├── database.ts          # Database connection and query utilities
│   │   │   ├── models/              # Database model definitions
│   │   │   │   ├── tradeModel.ts
│   │   │   │   ├── candleModel.ts
│   │   │   │   └── accountModel.ts
│   │   │   ├── migrations/          # Database migration scripts
│   │   │   └── __tests__/           # Unit tests for database feature
│   │   │
│   │   ├── mcp/           # MCP protocol handling and MCP-specific logic
│   │   │   ├── mcpServer.ts         # MCP server implementation
│   │   │   ├── mcpTypes.ts          # MCP-specific TypeScript interfaces
│   │   │   ├── mcpHandlers.ts       # MCP request handlers
│   │   │   └── __tests__/           # Unit tests for MCP feature
│   │   │
│   │   └── daemon/        # Daemon services (event buffering, background tasks)
│   │       ├── eventBuffer.ts       # Core event buffering logic (persisting events to file)
│   │       ├── eventTypes.ts        # Event type definitions
│   │       ├── backgroundProcessor.ts # Background task processing logic
│   │       └── __tests__/           # Unit tests for daemon feature
│   │
│   ├── services/          # Business logic layer (application services)
│   │   ├── eventBuffer/   # Event buffering service (already started!)
│   │   │   ├── eventBufferService.ts  # Service interface for event buffering
│   │   │   └── eventBufferServiceImpl.ts # Implementation details
│   │   │
│   │   ├── tradeStore/    # Application state management (trade store)
│   │   │   ├── tradeStoreService.ts   # Service interface for trade state
│   │   │   └── tradeStoreServiceImpl.ts # Implementation using Zustand, Redux, or custom
│   │   │
│   │   ├── websocket/     # WebSocket connection handling and broadcasting
│   │   │   ├── websocketService.ts    # Service interface for WS connections
│   │   │   └── websocketServiceImpl.ts # Implementation details
│   │   │
│   │   ├── api/           # External API wrappers (Peron, etc.)
│   │   │   ├── peronApi.ts          # Wrapper for Peron MT5 package
│   │   │   ├── mt5DirectApi.ts      # Wrapper for direct MT5 connection
│   │   │   └── externalApi.ts       # Other external API wrappers
│   │   │
│   │   └── ...            # Other service modules (auth, notification, etc.)
│   │
│   ├── controllers/       # Request handlers (grouped by feature/resource)
│   │   ├── mt5/           # MT5-related endpoints
│   │   │   ├── mt5Controller.ts       # Main MT5 controller
│   │   │   ├── symbolsController.ts   # Symbol-related endpoints
│   │   │   ├── ticksController.ts     # Tick data endpoints
│   │   │   ├── candlesController.ts   # Candle data endpoints
│   │   │   └── accountController.ts   # Account information endpoints
│   │   │
│   │   ├── trade/         # Trade operation endpoints
│   │   │   ├── tradeController.ts     # Main trade operations controller
│   │   │   ├── positionController.ts  # Position management endpoints
│   │   │   └── orderController.ts     # Order management endpoints
│   │   │
│   │   ├── strategy/      # Strategy-related endpoints
│   │   │   ├── strategyController.ts  # Strategy management endpoints
│   │   │   ├── backtestController.ts  # Strategy backtesting endpoints
│   │   │   └── validationController.ts # Strategy validation endpoints
│   │   │
│   │   ├── mcp/           # MCP-related endpoints
│   │   │   ├── mcpController.ts       # MCP JSON-RPC endpoint handler
│   │   │   └── sseController.ts       # MCP SSE transport handler
│   │   │
│   │   └── daemon/        # Daemon-related endpoints (events, etc.)
│   │       ├── eventController.ts     # Event buffering endpoints
│   │       └── backgroundController.ts # Background task management endpoints
│   │
│   ├── routes/            # API route definitions (feature-based)
│   │   ├── mt5Routes.ts           # MT5 API route definitions
│   │   ├── tradeRoutes.ts         # Trade operation API route definitions
│   │   ├── strategyRoutes.ts      # Strategy API route definitions
│   │   ├── mcpRoutes.ts           # MCP API route definitions
│   │   ├── daemonRoutes.ts        # Daemon API route definitions
│   │   └── indexRoutes.ts         # Main router that combines all feature routes
│   │
│   ├── middleware/        # Custom middleware (auth, logging, error handling, etc.)
│   │   ├── authMiddleware.ts        # Authentication middleware
│   │   ├── loggingMiddleware.ts     # Request/response logging middleware
│   │   ├── errorMiddleware.ts       # Error handling middleware
│   │   ├── validationMiddleware.ts  # Request validation middleware
│   │   └── corsMiddleware.ts        # CORS handling middleware
│   │
│   └── integrations/      # Third-party service integrations (if any)
│       ├── notification/          # Notification services (email, SMS, etc.)
│       │   ├── emailService.ts
│       │   └── smsService.ts
│       └── monitoring/            # Monitoring and logging integrations
│           ├── sentryIntegration.ts
│           └── datadogIntegration.ts
```

## Key Principles
1. **Domain-Driven Organization**: Group code by business domain (MT5, strategies, database, etc.)
2. **Clear Separation of Concerns**: 
   - `features`: Contains domain entities, business rules, and domain-specific logic (the "what" and "core logic")
   - `services`: Contains application services that orchestrate features and handle external interactions (the "how" of using features)
   - `controllers`: Handle HTTP requests, validate input, and delegate to services (adapt delivery mechanism to application logic)
   - `routes`: Define API endpoints and associate them with controllers (define the public contract)
   - `core`: Shared utilities, types, and configuration used across modules
3. **Dependency Direction**: Dependencies should flow inward: controllers → services → features → core. Features should not depend on services or controllers.
4. **Scalability**: New features can be added in their own directories under `features/` with corresponding services, controllers, and routes
5. **Maintainability**: Related code is co-located, making it easier to find, understand, and modify
6. **Consistency**: Clear naming conventions and structure reduce cognitive load and prevent architectural drift
7. **Testability**: Each module can be tested in isolation with mocked dependencies

## Detailed Migration Steps
1. **Prepare the Foundation**:
   - Create the new directory structure in `backend/src/`
   - Update `tsconfig.json` path aliases if needed to accommodate the new structure
   - Set up barrel exports (index.ts files) for easier imports where appropriate

2. **Migrate Domain Logic (Features)**:
   - Move MT5-related code to `src/features/mt5/`:
     * MT5 bridge/connection logic → `mt5Bridge.ts`
     * MT5-specific types/interfaces → `mt5Types.ts`
     * MT5 utility functions → `mt5Utils.ts`
     * MT5 constants → `mt5Constants.ts`
   - Move strategy-related code to `src/features/strategies/`:
     * Strategy execution logic → `strategyEngine.ts`
     * Strategy types/interfaces → `strategyTypes.ts`
     * Backtesting logic → `backtester.ts`
     * Strategy validation → `strategyValidator.ts`
   - Move database-related code to `src/features/database/`:
     * Database connection/utils → `database.ts`
     * Model definitions → `models/` directory
     * Migration scripts → `migrations/` directory
   - Move MCP-related code to `src/features/mcp/`:
     * MCP server implementation → `mcpServer.ts`
     * MCP types/interfaces → `mcpTypes.ts`
     * MCP handlers → `mcpHandlers.ts`
   - Move daemon/event buffering code to `src/features/daemon/`:
     * Event buffering core logic → `eventBuffer.ts`
     * Event type definitions → `eventTypes.ts`
     * Background processing logic → `backgroundProcessor.ts`

3. **Organize Application Services**:
   - Create service implementations in appropriate service directories:
     * Event buffering service → `src/services/eventBuffer/`
     * Trade state service → `src/services/tradeStore/`
     * WebSocket service → `src/services/websocket/`
     * External API wrappers → `src/services/api/`
   - Each service should have a clear interface and implementation

4. **Restructure Controllers**:
   - Group controllers by feature/resource in `src/controllers/`:
     * MT5 controllers → `src/controllers/mt5/`
     * Trade controllers → `src/controllers/trade/`
     * Strategy controllers → `src/controllers/strategy/`
     * MCP controllers → `src/controllers/mcp/`
     * Daemon controllers → `src/controllers/daemon/`
   - Each controller should focus on handling HTTP concerns (validation, response formatting) and delegate business logic to services

5. **Reorganize Routes**:
   - Split the monolithic `apiRoutes.ts` into feature-based route files in `src/routes/`:
     * `mt5Routes.ts` - MT5-related endpoints
     * `tradeRoutes.ts` - Trade operation endpoints
     * `strategyRoutes.ts` - Strategy-related endpoints
     * `mcpRoutes.ts` - MCP-related endpoints
     * `daemonRoutes.ts` - Daemon/event buffering endpoints
   - Create an `indexRoutes.ts` that combines all feature routes for application registration

6. **Refine Middleware**:
   - Move existing middleware to `src/middleware/` and organize by concern:
     * Authentication, logging, error handling, validation, CORS
   - Ensure middleware follows the correct execution order

7. **Handle Integrations**:
   - Create `src/integrations/` for third-party service integrations:
     * Notification services (email, SMS, etc.)
     * Monitoring and logging integrations (Sentry, Datadog, etc.)

8. **Update Import Paths**:
   - Throughout the codebase, update import paths to reflect the new structure
   - Use path aliases if configured in `tsconfig.json` for cleaner imports
   - Example: Instead of `../../../services/eventBuffer`, use `@/services/eventBuffer` or relative paths based on new structure

9. **Verify and Test**:
   - Ensure the application still compiles without errors
   - Run existing tests to verify functionality is preserved
   - Manually test key features to ensure nothing is broken
   - Update any configuration files that reference old paths

## Benefits
- Clear separation between domain logic, application services, and delivery mechanisms
- Easier to locate code related to a specific feature (all MT5 code in one area)
- Simplifies onboarding for new developers (clear structure reduces learning curve)
- Reduces coupling between unrelated parts of the system (changes to MT5 don't affect strategies)
- Makes the codebase more scalable as it grows (new features fit naturally into structure)
- Improves maintainability by grouping related code (easier to find and modify)
- Enhances testability (modules can be tested in isolation)

## Notes on Daemon/Event Buffering
The event buffering service (daemon) can be approached in multiple ways depending on how we conceptualize it:

**Option 1: As a Feature** (`src/features/daemon/`)
- Appropriate if we consider event buffering a core business domain
- Contains domain logic: event types, buffering algorithms, persistence strategies
- Would have corresponding services, controllers, and routes

**Option 2: As an Infrastructure Service** (`src/services/eventBuffer/`)
- Appropriate if we consider it a technical capability that supports other features
- Focuses on providing a service interface to other parts of the system
- Currently selected approach as it's used by WebSocket server and other components

**Option 3: As a Background Service** (`src/services/background/eventBuffer/`)
- Appropriate if we want to group all background/daemon-like services together
- Could include other background tasks like data cleanup, report generation, etc.

Given the user's initial request to create `backend/helpers/daemon` and the current usage pattern (WebSocket server depends on it), we'll proceed with Option 2 (`src/services/eventBuffer/`) for consistency with how it's currently used. However, the structure is flexible enough to accommodate either approach.

## Files to Create
- Directory structure as outlined above
- No new files are strictly required for the plan itself, but we will need to create directories and move existing files into the new structure

## Example Movements
- `backend/services/eventBuffer.ts` → `backend/src/services/eventBuffer/eventBufferService.ts`
- `backend/controllers/mt5Controller.ts` → `backend/src/controllers/mt5/mt5Controller.ts`
- `backend/routes/apiRoutes.ts` → Split into:
  * `backend/src/routes/mt5Routes.ts`
  * `backend/src/routes/tradeRoutes.ts`
  * `backend/src/routes/strategyRoutes.ts`
  * `backend/src/routes/mcpRoutes.ts`
  * `backend/src/routes/daemonRoutes.ts`
  * `backend/src/routes/indexRoutes.ts`

## Important: Update tsconfig.json paths if necessary to accommodate the new structure.
Consider adding path aliases like:
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@core/*": ["core/*"],
      "@features/*": ["features/*"],
      "@services/*": ["services/*"],
      "@controllers/*": ["controllers/*"],
      "@routes/*": ["routes/*"]
    }
  }
}
```
This would allow imports like `import { eventBufferService } from '@/services/eventBuffer'` instead of relative paths.
