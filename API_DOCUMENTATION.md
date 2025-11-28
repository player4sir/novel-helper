# API Documentation

This documentation outlines the API endpoints for the Novel Helper backend.

**Base URL**: `https://novelz.zeabur.app/api`
**Authentication**: Session-based. Most endpoints require authentication. The session cookie `connect.sid` must be included in requests.

## Authentication & User

### Login / Session
Authentication is handled via Passport.js.
- **POST** `/api/login` (Likely exists, though not explicitly seen in `routes.ts`, usually in `auth.ts` setup)
- **POST** `/api/logout` (Likely exists)
- **GET** `/api/user` (Likely exists to get current user info)

### User Management
- **POST** `/api/user/password`: Change password.
    - Body: `{ currentPassword, newPassword }`
- **GET** `/api/user/payments`: Get payment history.

## Projects

- **GET** `/api/projects`: List all projects for the current user.
- **GET** `/api/projects/:id`: Get a specific project.
- **POST** `/api/projects`: Create a new project.
    - Body: `{ title, genre, style?, targetWordCount?, description? }`
- **PATCH** `/api/projects/:id`: Update a project.
- **DELETE** `/api/projects/:id`: Delete a project.
    - Query: `force=true` (optional)
- **GET** `/api/projects/:id/dependencies`: Get project dependencies (for delete confirmation).
- **POST** `/api/projects/:id/archive`: Archive a project.
- **POST** `/api/projects/:id/unarchive`: Unarchive a project.
- **POST** `/api/projects/:id/duplicate`: Duplicate a project.
    - Body: `{ newTitle }`
- **GET** `/api/projects/:id/statistics`: Get project statistics.

## Volumes

- **GET** `/api/volumes`: Get volumes for a project.
    - Query: `projectId`
- **POST** `/api/volumes`: Create a volume.
    - Body: `{ projectId, title, orderIndex, description? }`
- **DELETE** `/api/volumes/:id`: Delete a volume.
- **POST** `/api/volumes/generate`: AI-driven volume generation.
    - Body: `{ projectId, targetVolumeCount }`
- **POST** `/api/volumes/append`: AI-driven volume append.
    - Body: `{ projectId, additionalCount }`

## Chapters

- **GET** `/api/chapters`: Get chapters for a project.
    - Query: `projectId`
- **GET** `/api/chapters/:projectId`: Get chapters for a project (alternate).
- **GET** `/api/chapter/:id`: Get a specific chapter.
- **POST** `/api/chapters`: Create a chapter.
    - Body: `{ projectId, volumeId, title, content, status }`
- **PATCH** `/api/chapters/:id`: Update a chapter.
    - Body: `{ title?, content?, status?, wordCount? }`
- **DELETE** `/api/chapters/:id`: Delete a chapter.
- **POST** `/api/chapters/generate`: AI-driven chapter generation.
    - Body: `{ projectId, volumeId, targetChapterCount }`
- **POST** `/api/chapters/append`: AI-driven chapter append.
    - Body: `{ projectId, volumeId, additionalCount, instruction }`
- **POST** `/api/chapters/reorder`: Reorder chapters.
    - Body: `{ projectId, chapterIds: [], volumeId? }`
- **POST** `/api/chapters/:id/move`: Move chapter to a different volume.
    - Body: `{ targetVolumeId }`
- **GET** `/api/chapters/:id/summary-chain`: Get summary chain for a chapter.
- **GET** `/api/chapters/:id/generate-content-stream`: Generate chapter content (SSE).
    - Query: `projectId`, `styleProfileId`
- **POST** `/api/chapters/:id/polish`: Polish chapter content.
    - Body: `{ projectId, focusAreas: [] }`
- **POST** `/api/chapters/:id/check-coherence`: Check chapter coherence.
    - Body: `{ projectId }`

## Outlines

- **GET** `/api/outlines`: Get outlines for a project.
    - Query: `projectId`
- **GET** `/api/outlines/:projectId`: Get outlines for a project (alternate).
- **POST** `/api/outlines`: Create an outline.
- **PATCH** `/api/outlines/:id`: Update an outline.
- **DELETE** `/api/outlines/:id`: Delete an outline.

## Characters

- **GET** `/api/characters`: Get characters for a project.
    - Query: `projectId`, `hasCurrentGoal` (bool), `hasCurrentEmotion` (bool), `notAppeared` (bool)
- **GET** `/api/characters/:projectId`: Get characters for a project (alternate).
- **POST** `/api/characters`: Create a character.
    - Body: `{ projectId, name, role, gender?, age?, appearance?, personality?, background?, abilities?, growth?, notes? }`
- **PATCH** `/api/characters/:id`: Update a character.
- **DELETE** `/api/characters/:id`: Delete a character.
- **POST** `/api/characters/:id/relationships`: Add/Update relationship.
    - Body: `{ targetCharacterId, type, strength, description }`
- **GET** `/api/characters/:id/relationships`: Get character relationships.
- **PATCH** `/api/characters/:id/relationships/:targetId`: Update specific relationship.
- **GET** `/api/characters/:id/arc-points`: Get character arc points.
- **POST** `/api/characters/:id/arc-points`: Add character arc point.
    - Body: `{ arcPoint, chapterId?, chapterIndex?, sceneIndex?, notes? }`
- **GET** `/api/characters/:id/state-history`: Get character state history.
    - Query: `limit`, `chapterId`, `fromDate`, `toDate`

## World Settings

- **GET** `/api/world-settings/:projectId`: Get world settings for a project.
- **POST** `/api/world-settings`: Create a world setting.
    - Body: `{ projectId, category, title, content, tags?, details? }`
- **PATCH** `/api/world-settings/:id`: Update a world setting.
- **DELETE** `/api/world-settings/:id`: Delete a world setting.

## AI Models & Prompts

- **GET** `/api/ai-models`: Get user's AI models.
- **POST** `/api/ai-models`: Add an AI model.
- **PATCH** `/api/ai-models/:id`: Update an AI model.
- **DELETE** `/api/ai-models/:id`: Delete an AI model.
- **POST** `/api/ai-models/:id/set-default`: Set default AI model.
- **POST** `/api/ai-models/test`: Test AI model connection.
- **GET** `/api/prompt-templates`: Get prompt templates.
    - Query: `projectId`
- **POST** `/api/prompt-templates`: Create a prompt template.
- **PATCH** `/api/prompt-templates/:id`: Update a prompt template.
- **DELETE** `/api/prompt-templates/:id`: Delete a prompt template.

## Plot Cards

- **GET** `/api/plot-cards/:projectId`: Get plot cards.
- **POST** `/api/plot-cards`: Create a plot card.
- **PATCH** `/api/plot-cards/:id`: Update a plot card.
- **DELETE** `/api/plot-cards/:id`: Delete a plot card.
- **POST** `/api/plot-cards/generate`: Generate plot card content.
    - Body: `{ title, type, tags, projectId? }`

## Creation Workflow

- **POST** `/api/creation/session`: Start a creation session.
    - Body: `{ titleSeed, premise?, genre?, style?, targetWordCount? }`
- **GET** `/api/creation/auto`: Auto creation (SSE).
    - Query: `titleSeed`, `premise`, `genre`, `style`, `targetWordCount`, `userId`
- **POST** `/api/creation/step/next`: Execute next step in creation.
    - Body: `{ sessionId, data }`
- **POST** `/api/creation/step/regenerate`: Regenerate a step.
    - Body: `{ sessionId, step?, options? }`
- **POST** `/api/creation/confirm`: Finalize creation.
    - Body: `{ sessionId, overrides? }`
- **POST** `/api/sessions/create`: Create a session (New API).
- **GET** `/api/sessions/:id`: Get session details.
- **POST** `/api/creation/quick`: Quick creation.
- **POST** `/api/creation/stepwise/start`: Start stepwise creation.
- **POST** `/api/creation/stepwise/:sessionId/next`: Next step (Stepwise).
- **POST** `/api/creation/stepwise/:sessionId/regenerate`: Regenerate (Stepwise).
- **POST** `/api/creation/stepwise/:sessionId/finalize`: Finalize (Stepwise).
- **POST** `/api/creation/stepwise/:sessionId/pause`: Pause creation.
- **POST** `/api/creation/stepwise/:sessionId/resume`: Resume creation.
- **GET** `/api/creation/sessions/incomplete`: Get incomplete sessions.
- **GET** `/api/creation/stepwise/:sessionId`: Get stepwise session details.
- **GET** `/api/creation/recommendations/:userId`: Get personalized recommendations.

## Editor AI

- **POST** `/api/editor/ai-instruction`: Process AI instruction.
    - Body: `{ instruction, selectedText, cursorPosition, chapterContent, chapterId, projectId }`
- **POST** `/api/editor/ai-instruction-stream`: Process AI instruction (SSE).
- **POST** `/api/editor/diagnose`: Diagnose chapter content.

## Scenes & Drafts

- **GET** `/api/scene-frames/:chapterId`: Get scene frames for a chapter.
- **GET** `/api/draft-chunks/:sceneId`: Get draft chunks for a scene.
- **POST** `/api/scenes/:id/regenerate`: Regenerate a scene.
    - Body: `{ projectId, chapterId }`

## Statistics & History

- **GET** `/api/statistics/today/summary`: Get today's summary stats.
- **POST** `/api/statistics`: Record statistics.
- **GET** `/api/history/session/:sessionId`: Get session history.
- **GET** `/api/history/user/:userId`: Get user history.
- **POST** `/api/history/:id/restore`: Restore from history.
- **GET** `/api/generation-logs`: Query generation logs.
- **GET** `/api/generation-logs/:executionId`: Get specific generation log.
- **GET** `/api/generation-logs/stats/:projectId`: Get generation stats.

## System & Config

- **GET** `/api/genres`: Get genre config.
- **GET** `/api/genres/:id`: Get specific genre config.
- **GET** `/api/system/compatibility`: Check system compatibility.
- **GET** `/api/system/features`: Get feature flags.
- **POST** `/api/system/features/:featureName/enable`: Enable feature.
- **POST** `/api/system/features/:featureName/disable`: Disable feature.

## Styles

- **POST** `/api/styles/extract`: Extract style from text.
- **GET** `/api/styles`: Get style profiles.
- **POST** `/api/styles`: Create style profile.
- **DELETE** `/api/styles/:id`: Delete style profile.

## Payments

- **POST** `/api/payment/create`: Create payment order.
    - Body: `{ amount, provider, planId, description }`
- **GET** `/api/payment/status/:orderId`: Get payment status.
