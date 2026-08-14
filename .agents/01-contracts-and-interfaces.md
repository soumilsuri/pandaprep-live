# 01 — API Contracts and Interfaces

## 1. Markdown-First Architecture Philosophy

PandaPrep adopts a **Markdown-First** model:
- The backend generates clean, structured Markdown (with standard LaTeX math `$..$` and `$$..$$`).
- Raw Markdown (~18 KB per note set) is stored directly in MongoDB (`notes_workspaces` and `NotesRequestModel.markdown_content`).
- The frontend renders the notes interactively in a Claude-style reader panel using `react-markdown` + `rehype-katex`.
- Students can read interactively, copy markdown, and click **"Download as PDF"** which triggers native browser `window.print()` (with clean `@media print` CSS), eliminating the external PDF microservice and Cloudinary PDF storage completely.

---

## 2. Notes Generation API Contract

### Endpoint: `POST /api/pipeline/generate-notes`
- **Authentication**: Bearer token verified via Firebase Admin (`verifyFirebaseToken` middleware).
- **Behavior**: Asynchronous initiation. Validates input, creates a mission record in MongoDB, queues the job, and immediately returns HTTP 202 Accepted.

#### Request Headers
```http
Authorization: Bearer <Firebase_ID_Token>
Content-Type: application/json
```

#### Request Payload (`application/json`)
```json
{
  "email": "student@example.com",
  "syllabus": "Unit 1: Binary Trees and Traversals\nUnit 2: Balanced Trees (AVL, Red-Black)\nUnit 3: Graph Representations and Shortest Paths",
  "subject_name": "Data Structures & Algorithms",
  "note_type": "detailed",
  "include_examples": "yes",
  "include_images": "no",
  "education_level": "intermediate",
  "user_instructions": "Focus heavily on time complexities and edge cases for tree rotations.",
  "relativePathToReferenceMaterial": "https://res.cloudinary.com/pandaprep/raw/upload/v1/reference_doc.pdf",
  "format": "markdown"
}
```

#### Synchronous Response (HTTP 202 Accepted)
```json
{
  "success": true,
  "message": "Notes generation queued",
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "jobId": "66bc0f1245a9e38d7b89e123",
  "estimatedTimeSeconds": 45
}
```

---

## 3. Status Polling API Contract (Delivers Markdown)

The frontend polls this endpoint every 2–4 seconds until `status === 'completed'`.

### Endpoint: `GET /api/pipeline/generation-status/:requestId`
- **Authentication**: Bearer token verified via Firebase Admin (`verifyFirebaseToken`).

#### Response Payload (`application/json`)

**In Progress:**
```json
{
  "success": true,
  "status": "processing",
  "error": null,
  "markdown": null,
  "processingTimeMs": null
}
```

**Completed (Notes Ready):**
```json
{
  "success": true,
  "status": "completed",
  "error": null,
  "markdown": "# Data Structures & Algorithms Revision Notes\n\n## 1. Binary Search Trees\n...",
  "downloadUrl": null,
  "processingTimeMs": 38200
}
```

**Failed:**
```json
{
  "success": true,
  "status": "failed",
  "error": "Failed during reference document grounding verification",
  "markdown": null,
  "processingTimeMs": null
}
```

---

## 4. Database Schema Updates (`NotesRequestModel`)

To store the generated markdown directly in MongoDB without filling the database:

```javascript
// src/models/user-request.model.js
const notesRequestSchema = new mongoose.Schema({
  _userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject_name: { type: String, required: true },
  display_name: { type: String },
  syllabus: { type: String, required: true },
  note_type: { type: String, enum: ['concise', 'detailed', 'qa'], default: 'concise' },
  education_level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  user_instructions: { type: String },
  
  // Storage fields:
  markdown_content: { type: String }, // Stores full generated markdown (~18 KB)
  status: { type: String, enum: ['pending', 'queued', 'processing', 'completed', 'failed'], default: 'pending' },
  requestId: { type: String, required: true, unique: true },
  processing_time_ms: { type: Number },
  created_at: { type: Date, default: Date.now }
});
```

*Note: 18 KB markdown is ~50x smaller than a PDF. Storing 1,000 notes takes only ~18 MB in MongoDB Atlas.*

---

## 5. Frontend Reader & Print Integration

### 5.1 `frontend/src/app/generate/page.tsx`
1. **Replace PDF Iframe with Markdown Viewer**:
   - In place of `<iframe src={downloadId} />`, render an interactive `<MarkdownViewer markdown={markdownContent} />` built with `react-markdown` and `rehype-katex`.
2. **Download Button (`window.print()`)**:
   - Update `downloadGeneratedNotes()` to call `window.print()`.
   - Add standard print CSS in `globals.css`:
   ```css
   @media print {
     header, nav, .sidebar, .action-buttons { display: none !important; }
     .markdown-reader { width: 100% !important; margin: 0 !important; font-size: 12pt; }
   }
   ```

### 5.2 `frontend/src/app/history/page.tsx`
- History list queries `GET /api/user-history/my-notes` which returns the `markdown_content`.
- Clicking a historical note opens the note directly in the Markdown reader modal/view with instant load time (no external PDF fetch).

---

## 6. Q&A / Interactive Chat API Contracts

### Query Notes Workspace
`POST /api/chat/chat-with-notes`
- **Body**: `{ "query": "Explain AVL balance factor edge cases", "missionId": "mission_uuid" }`
- **Response** (HTTP 200):
```json
{
  "success": true,
  "response": "In an AVL tree, the Balance Factor is defined as...",
  "sources": [
    { "section": "sec_02", "snippet": "Balance Factor = Height(L) - Height(R)" }
  ]
}
```
