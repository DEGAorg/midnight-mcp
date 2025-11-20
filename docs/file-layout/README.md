# File Layout Documentation

This directory contains comprehensive documentation about the project's folder structure and file organization.

## Documents

1. **[STRUCTURE.md](./STRUCTURE.md)** - Complete folder structure overview
2. **[GUIDELINES.md](./GUIDELINES.md)** - Guidelines for where to place new code
3. **[MIGRATION.md](./MIGRATION.md)** - Mapping from old structure to new structure
4. **[EXAMPLES.md](./EXAMPLES.md)** - Real-world examples of file organization

## Quick Reference

### Where Should My Code Go?

- **Business Logic** → `src/services/`
- **Database Code** → `src/lib/database/`
- **API Endpoints** → `src/api/routes/`
- **MCP Tools** → `src/mcp/tools/`
- **Shared Types** → `src/types/`
- **Configuration** → `src/lib/config/`
- **Utilities** → `src/lib/utils/`

## Philosophy

Our file structure follows these principles:

1. **Feature-based Organization** - Group by feature/domain, not by technical layer
2. **Clear Separation of Concerns** - API, MCP, Services are separate
3. **Next.js/TypeScript Style** - Familiar patterns, not over-engineered DDD
4. **Simple and Practical** - Easy to navigate, no deep nesting
5. **Testable** - Structure supports easy unit and integration testing

## See Also

- [Architecture Overview](../ARCHITECTURE.md)
- [API Documentation](../API.md)
- [MCP Documentation](../MCP.md)
