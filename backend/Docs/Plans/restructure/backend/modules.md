# Backend Modules Guide

## What is a Module?
In our restructured backend, a module is a cohesive unit of code that encapsulates a specific business domain or feature. Each module consists of several interconnected parts that work together to provide functionality related to that domain, following principles of domain-driven design and separation of concerns.

## Module Structure
A typical module in our backend includes the following components, organized in layers:

### 1. Feature (Domain Logic) - `src/features/<module-name>/`
   - Contains the core domain entities, business rules, and domain-specific logic
   - Represents the "what" and "core logic" of the module - the essence of the business domain
   - Independent of application frameworks, databases, or external services
   - Should be testable in isolation with no external dependencies
   - Examples: MT5 trading logic, strategy execution rules, data validation algorithms

### 2. Services (Application Logic) - `src/services/<module-name>/` or relevant service directories
   - Contains application services that orchestrate the feature logic
   - Represents the "how" of using the feature in application contexts
   - Handles interactions with external systems (databases, APIs, file systems, etc.)
   - Manages application state and transactions
   - Translates domain concepts to application concepts and vice versa
   - Examples: Trade state management service, event buffering service, external API wrappers

### 3. Controllers (Delivery Mechanism) - `src/controllers/<module-name>/`
   - Contains request handlers that translate HTTP requests to service calls
   - Represents the "entry points" for external access to the module
   - Handles HTTP-specific concerns: validation, authentication, response formatting
   - Delegates business logic to services
   - Should contain minimal business logic - primarily adapts HTTP to application layer
   - Examples: MT5 request handlers, trade operation controllers, strategy management endpoints

### 4. Routes (API Definition) - `src/routes/<module-name>Routes.ts`
   - Defines the API endpoints and associates them with controllers
   - Represents the "contract" for how the module is accessed externally
   - Documents the public interface of the module
   - Handles routing concerns: path definitions, HTTP methods, middleware application
   - Examples: MT5 API route definitions, trade operation API routes, strategy API routes

## Complete Module Example: MT5 Module
```
backend/
├── src/
│   ├── features/
│   │   └── mt5/                           # MT5 domain logic
│   │       ├── mt5Bridge.ts               # Core MT5 connection and protocol handling
│   │   │   ├── mt5Types.ts                # MT5-specific TypeScript interfaces
│   │   │   ├── mt5Utils.ts                # MT5-specific utility functions
│   │   │   ├── mt5Constants.ts            # MT5-specific constants
│   │   │   ├── orderExecutionLogic.ts     # Core order execution business rules
│   │   │   ├── positionManagementLogic.ts # Core position management business rules
│   │   │   └── __tests__/                 # Unit tests for MT5 feature
│   │
│   ├── services/
│   │   ├── mt5/                           # MT5-related services
│   │   │   ├── mt5Service.ts              # Main MT5 service interface
│   │   │   ├── mt5ServiceImpl.ts          # MT5 service implementation
│   │   │   ├── peronMt5Adapter.ts         # Adapter for Peron MT5 package
│   │   │   └── directMt5Adapter.ts        # Adapter for direct MT5 connection
│   │   │
│   │   ├── tradeStore/                    # Trade state service (used by MT5 but shared)
│   │   │   ├── tradeStoreService.ts
│   │   │   └── tradeStoreServiceImpl.ts
│   │   │
│   │   └── websocket/                     # WebSocket service (used by MT5 but shared)
│   │       ├── websocketService.ts
│   │       └── websocketServiceImpl.ts
│   │
│   ├── controllers/
│   │   └── mt5/                           # MT5 request handlers
│   │       ├── mt5Controller.ts           # Main MT5 controller
│   │   │   ├── symbolsController.ts       # Symbol-related endpoints
│   │   │   ├── ticksController.ts         # Tick data endpoints
│   │   │   ├── candlesController.ts       # Candle data endpoints
│   │   │   ├── accountController.ts       # Account information endpoints
│   │   │   ├── orderController.ts         # Order management endpoints
│   │   │   └── positionController.ts      # Position management endpoints
│   │   │
│   └── routes/
│       └── mt5Routes.ts                   # MT5 API route definitions
```

## Complete Module Example: Strategy Module
```
backend/
├── src/
│   ├── features/
│   │   └── strategies/                    # Strategy domain logic
│   │       ├── strategyEngine.ts          # Core strategy execution logic
│   │   │   ├── strategyTypes.ts           # Strategy-related TypeScript interfaces
│   │   │   ├── backtester.ts              # Strategy backtesting implementation
│   │   │   ├── strategyValidator.ts       # Strategy validation logic
│   │   │   ├── riskManager.ts             # Strategy risk management logic
│   │   │   └── __tests__/                 # Unit tests for strategies feature
│   │
│   ├── services/
│   │   ├── strategies/                    # Strategy-related services
│   │   │   ├── strategyService.ts         # Strategy service interface
│   │   │   ├── strategyServiceImpl.ts     # Strategy service implementation
│   │   │   ├── strategyRepository.ts      # Strategy data access layer
│   │   │   └── backtestService.ts         # Backtesting service
│   │   │
│   │   └── tradeStore/                    # Shared trade state service
│   │       ├── tradeStoreService.ts
│   │       └── tradeStoreServiceImpl.ts
│   │
│   ├── controllers/
│   │   └── strategy/                      # Strategy-related endpoints
│   │       ├── strategyController.ts      # Strategy management controller
│   │   │   ├── backtestController.ts      # Strategy backtesting controller
│   │   │   └── validationController.ts    # Strategy validation controller
│   │   │
│   └── routes/
│       └── strategyRoutes.ts              # Strategy API route definitions
```

## Complete Module Example: Daemon/Event Buffering Module
```
backend/
├── src/
│   ├── features/
│   │   └── daemon/                        # Daemon domain logic (if considered a feature)
│   │       ├── eventBuffer.ts             # Core event buffering logic
│   │   │   ├── eventTypes.ts              # Event type definitions
│   │   │   ├── persistenceStrategy.ts     # Event persistence strategies
│   │   │   ├── eventFilteringLogic.ts     # Event filtering business rules
│   │   │   └── __tests__/                 # Unit tests for daemon feature
│   │
│   ├── services/
│   │   └── eventBuffer/                   # Event buffering service (implementation)
│   │       ├── eventBufferService.ts      # Service interface
│   │   │   ├── eventBufferServiceImpl.ts  # Service implementation
│   │   │   ├── backgroundProcessor.ts     # Background task processing
│   │   │   └── eventScheduler.ts          # Event scheduling logic
│   │
│   ├── controllers/
│   │   └── daemon/                        # Daemon-related endpoints
│   │       ├── eventController.ts         # Event buffering endpoints
│   │   │   └── backgroundController.ts    # Background task management endpoints
│   │   │
│   └── routes/
│       └── daemonRoutes.ts                # Event buffering API routes
```

## Guidelines for Creating a New Module
1. **Start with the Feature (Domain Logic)**: Begin by defining the domain logic in `src/features/<module-name>/`
   - Identify core entities, value objects, and business rules
   - Implement domain services that encapsulate complex business logic
   - Write tests for domain logic first (TDD approach)
   - Ensure no dependencies on frameworks, databases, or external services

2. **Identify Service Needs**: Determine what application services are needed
   - Consider what external systems the feature needs to interact with (databases, APIs, file systems, etc.)
   - Identify state management requirements
   - Determine what cross-cutting concerns need to be handled (transactions, caching, etc.)
   - Place services in the appropriate service directory:
     * Feature-specific services: `src/services/<module-name>/`
     * Shared services: `src/services/<shared-name>/` (e.g., tradeStore, websocket)
     * Infrastructure services: `src/services/infrastructure/` (e.g., logging, notification)

3. **Create Controllers**: For HTTP accessibility, create controllers in `src/controllers/<module-name>/`
   - Focus on HTTP concerns: request validation, response formatting, error handling
   - Delegate all business logic to services
   - Keep controllers thin - they should be adapters, not contain business logic
   - Apply appropriate middleware (authentication, validation, etc.) at the route level

4. **Define Routes**: Create a route file in `src/routes/<module-name>Routes.ts` that wires controllers to endpoints
   - Define clear, RESTful API endpoints
   - Apply appropriate middleware (authentication, rate limiting, etc.)
   - Document the API contract (can be enhanced with OpenAPI/Swagger later)
   - Ensure proper HTTP status codes and response formats

5. **Export and Register**: Ensure the route file is imported and registered in the main application
   - Import the route file in your main router/index file
   - Verify that endpoints are accessible at the expected paths
   - Test that middleware is applied correctly

6. **Consider Reusability**: If logic is truly shared across modules, consider moving it to appropriate shared locations
   - Truly generic utilities: `src/core/utils/`
   - Shared types/interfaces: `src/core/types/`
   - Shared services: `src/services/<shared-name>/`
   - Shared constants: `src/core/constants/` or `src/constants/`

## Module Independence and Communication
- **Ideal State**: Modules should be as independent as possible
- **Avoid Direct Dependencies**: Modules should not depend on each other's implementation details
- **Communication Patterns**:
  * **Services**: Modules can depend on shared services (e.g., both MT5 and strategies modules might depend on tradeStore service)
  * **Events**: Use event-driven communication for loose coupling (publish events that other modules can subscribe to)
  * **Shared Kernel**: For truly ubiquitous concepts, consider a shared kernel in `src/core/` that multiple modules can depend on
  * **Facades**: Create facade services that provide simplified interfaces to complex subsystems

## Cross-Layer Guidelines
### Features Layer
- Should contain only pure domain logic
- No dependencies on frameworks, databases, or external services
- Entities should have behavior (methods), not just be data bags
- Use domain-specific language in naming
- Prefer rich domain models over anemic ones

### Services Layer
- Orchestrates feature logic and handles external interactions
- Manages application state and transactions
- Translates between domain concepts and application/data concepts
- May depend on other services (especially shared infrastructure services)
- Implements use cases/application logic
- Should be testable with mocked dependencies

### Controllers Layer
- Handles HTTP-specific concerns only
- Validates incoming requests (though deep validation might belong in services)
- Formats outgoing responses
- Handles HTTP errors appropriately
- Delegates business logic to services
- Should be minimal - primarily an adapter

### Routes Layer
- Defines the public API contract
- Maps HTTP endpoints to controller methods
- Applies middleware (authentication, validation, logging, etc.)
- Documents API behavior (can be enhanced with documentation tools)
- Should be thin - primarily a wiring layer

## Benefits of Modular Organization
- **Encapsulation**: Each module hides its internal complexity behind a well-defined interface
- **Maintainability**: Changes to a module are localized and less likely to affect others
- **Scalability**: New modules can be added without disrupting existing ones
- **Team Collaboration**: Different teams can work on different modules with minimal conflict
- **Testability**: Modules can be tested in isolation with mocked dependencies
- **Replaceability**: Modules can be replaced with alternative implementations if interfaces are maintained
- **Understandability**: Clear structure makes it easier to understand the system at a glance
- **Discoverability**: Related code is easy to find when working on a specific feature

## Relationship to Other Structures
- **Frontend-Backend Alignment**: This modular approach complements the frontend feature-based organization
  - Backend modules correspond to frontend features (e.g., MT5 module ↔ dashboard trading features)
  - Shared core services (`src/core/`) support both backend modules and frontend services
  - API contracts (`src/routes/`) correspond to frontend service clients (`src/services/api/`)
- **Hexagonal Architecture/Ports and Adapters**: Our structure aligns with hexagonal architecture principles:
  - Core (features) = domain logic (hexagon center)
  - Services = application layer (inside hexagon)
  - Controllers/Routes = adapters (hexagon edges)
  - External systems (databases, APIs, etc.) = outside hexagon
- **Clean Architecture**: Similar to Clean Architecture with:
  - Entities (features layer)
  - Use cases (services layer)
  - Interface adapters (controllers/routes layers)
  - Frameworks and drivers (express, databases, etc., at the outermost layer)

## Testing Strategy for Modules
### Unit Testing
- **Features**: Test domain logic in isolation with no mocks (pure functions)
- **Services**: Test with mocked dependencies (repositories, external services, etc.)
- **Controllers**: Test with mocked services, focus on HTTP handling (validation, response formatting)
- **Routes**: Test routing and middleware application (can use supertest or similar)

### Integration Testing
- Test interactions between layers within a module
- Test module interactions with shared services
- Test API endpoints with real implementations of dependencies (can use test databases)

### Contract Testing
- Ensure API contracts are maintained
- Validate that frontend expectations match backend implementations

## Common Pitfalls to Avoid
1. **Leaky Abstractions**: Don't let framework or database specifics leak into the features layer
2. **Fat Controllers**: Don't put business logic in controllers - they should be thin adapters
3. **Circular Dependencies**: Avoid modules depending on each other in a circular fashion
4. **Over-engineering**: Don't create modules for trivial functionality; start simple and refactor when needed
5. **Ignoring Shared Kernel**: Don't duplicate ubiquitous concepts; put them in shared core when appropriate
6. **Inconsistent Naming**: Follow consistent naming conventions across all layers
7. **Neglecting Documentation**: Document module responsibilities and interfaces
8. **Tight Coupling**: Avoid direct dependencies between modules; use services or events for communication

## Conclusion
By organizing our backend into coherent modules with clear separation of concerns, we create a codebase that is easier to understand, maintain, test, and scale. Each module represents a vertical slice of functionality related to a specific business domain, making it clear where to look for and how to extend functionality. This approach promotes loose coupling, high cohesion, and aligns with industry best practices for scalable software architecture.

The modular structure also facilitates team collaboration, as different teams can work on different modules with minimal merge conflicts. It enables independent deployment of modules if needed in the future, and makes the system more resilient to change since modifications are localized to specific modules.