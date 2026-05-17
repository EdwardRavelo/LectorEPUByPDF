# Libris - Personal Book Reader

Libris is a lightweight, browser-based personal book reader SPA (Single Page Application) built with React, TypeScript, and Vite. It supports both PDF and ePub formats, providing a clean and focused reading experience.

## Project Overview

- **Purpose:** A personal library and reader where users can upload, read, and annotate PDF/ePub files.
- **Core Technologies:** React 19, TypeScript, Vite.
- **Key Libraries:**
  - `epubjs`: Core engine for rendering ePub files.
  - `react-pdf`: Wrapper for PDF.js to render PDF files.
  - `framer-motion`: Used for smooth animations and transitions.
  - `lucide-react`: Icon set.
  - `clsx` & `tailwind-merge`: Utility for handling CSS classes.
- **Persistence:** Uses **IndexedDB** (via a custom `DatabaseService`) to store:
  - **Books:** Actual book files (PDF/ePub) are stored as Blobs, allowing them to persist across sessions and page refreshes.
  - **Settings & Annotations:** Font size, theme, view mode, last location, highlights, and comments are all saved per book.
  - **Stable IDs:** Each book is assigned a stable ID generated from a **SHA-256 hash** of its content. This ensures that a book's settings and annotations remain linked even if the app is reloaded or the book is re-uploaded.

## Architecture

- **`src/App.tsx`**: The main entry point and layout. Manages the sidebar, book list, and file uploads.
- **`src/context/ReaderContext.tsx`**: Provides the global state for the active book, including its settings and annotations.
- **`src/services/database.ts`**: Handles all interactions with IndexedDB.
- **`src/components/`**:
  - `EpubReader.tsx`: Specialized reader for ePub files using `epubjs`.
  - `PdfReader.tsx`: Specialized reader for PDF files using `react-pdf`.
  - `shared/ReaderLayout.tsx`: Common UI components (toolbars, controls) shared by both readers.

## Building and Running

### Development
```bash
npm run dev
```
Starts the Vite development server with Hot Module Replacement (HMR).

### Production Build
```bash
npm run build
```
Type-checks the project using `tsc` and builds the production assets into the `dist/` directory.

### Linting
```bash
npm run lint
```
Runs ESLint to check for code quality and style issues.

### Preview
```bash
npm run preview
```
Serves the local production build for final verification.

## Deployment

The project is configured for deployment on **Vercel**.
- **Configuration:** See `vercel.json`.
- **Automatic Deploys:** Typically handled via Vercel's GitHub integration.

## Development Conventions

- **State Management:** Use the `ReaderContext` for any state that needs to be shared between the reader and the main layout.
- **Persistence:** All per-book data (settings, highlights, comments) should be persisted via `dbService` in `src/services/database.ts`.
- **Styling:** The project uses a mix of custom CSS variables (defined in `index.css`) and utility-like patterns. Follow the established variable names for themes (`--bg`, `--text`, `--accent`, etc.).
- **Themes:** Supports `light`, `sepia`, and `dark` modes. Ensure any new UI components respect these theme classes.
- **Annotations:**
  - ePub highlights use CFI ranges.
  - PDF highlights use page numbers and relative coordinates (normalized to 0-1) to ensure they scale correctly.
