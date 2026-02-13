# Contributing to XDC SkyNet

Thank you for your interest in contributing to XDC SkyNet! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+ (optional, for distributed rate limiting)
- npm or yarn

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/AnilChinchawale/XDCSkyNet.git
   cd XDCSkyNet/dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your database credentials
   ```

4. **Initialize the database**
   ```bash
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 📝 Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types for functions
- Avoid `any` - use `unknown` if type is truly unknown

### Code Formatting

We use ESLint and Prettier. Run before committing:
```bash
npm run lint
npm run format
```

### File Naming

- React components: `PascalCase.tsx`
- Utilities/hooks: `camelCase.ts`
- API routes: `route.ts` (Next.js convention)
- Tests: `*.test.ts` or `*.test.tsx`

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Place tests in `__tests__/` directories
- Use descriptive test names: `it('should return 401 when API key is invalid')`
- Mock external dependencies (database, Redis)
- Test both success and error paths

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/v1/nodes/register/route';
import { createAuthenticatedRequest } from '@/lib/test-utils';

describe('POST /api/v1/nodes/register', () => {
  it('should register a new node with valid data', async () => {
    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/register', {
      body: { name: 'test-node', host: 'https://example.com', role: 'fullnode' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
```

## 📦 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation if needed

3. **Run checks locally**
   ```bash
   npm run lint
   npm run type-check
   npm test
   ```

4. **Commit with a descriptive message**
   ```bash
   git commit -m "feat: add node health monitoring endpoint"
   ```
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation only
   - `style:` - Code style (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Fill out the PR template** with:
   - Description of changes
   - Related issues
   - Testing done
   - Screenshots (if UI changes)

## 🔍 Code Review

All PRs require at least one review before merging. Reviewers will check:

- Code quality and style
- Test coverage
- Documentation
- Security considerations
- Performance implications

## 🐛 Reporting Bugs

Use GitHub Issues with the bug report template. Include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Logs or error messages

## 💡 Suggesting Features

Open a GitHub Issue with the feature request template. Describe:

- The problem you're trying to solve
- Proposed solution
- Alternatives considered
- Additional context

## 📚 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments to public APIs
- Update OpenAPI spec for API changes
- Include code examples where helpful

## 🔒 Security

- Never commit secrets or credentials
- Report security vulnerabilities privately to security@xdc.network
- Follow OWASP guidelines for secure coding

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Join our [Discord](https://discord.gg/xdc) or open a GitHub Discussion.
