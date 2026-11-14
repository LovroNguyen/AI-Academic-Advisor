import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const roadmapData = [
  // ==========================================
  // 1. AI ENGINEER (Source: roadmap.sh/ai-engineer)
  // ==========================================
  {
    career: 'AI Engineer',
    section: '1. Mathematics & Statistical Foundations',
    content: `[roadmap.sh - AI Engineer / Milestone 1: Math Foundations]
• Linear Algebra: Vectors, Matrices, Matrix Multiplications, Determinants, Eigenvalues & Eigenvectors, Singular Value Decomposition (SVD).
• Multivariable Calculus: Gradients, Partial Derivatives, Chain Rule, Hessian Matrix, Gradient Descent optimization.
• Probability & Statistics: Probability distributions (Gaussian, Bernoulli, Binomial, Poisson), Bayes Theorem, Maximum Likelihood Estimation (MLE), Hypothesis Testing, Confidence Intervals, p-values.
• Python Scientific Stack: NumPy (multidimensional arrays, vectorization, broadcasting), Pandas (data manipulation, aggregation, cleaning), Matplotlib & Seaborn for exploratory data visualization.`,
    chunkIndex: 1,
  },
  {
    career: 'AI Engineer',
    section: '2. Classical Machine Learning & Feature Engineering',
    content: `[roadmap.sh - AI Engineer / Milestone 2: Machine Learning]
• Supervised Learning: Linear Regression, Logistic Regression, Decision Trees, Random Forests, Gradient Boosted Decision Trees (XGBoost, LightGBM, CatBoost), Support Vector Machines (SVM), k-Nearest Neighbors (k-NN).
• Unsupervised Learning: K-Means Clustering, DBSCAN, Hierarchical Clustering, Principal Component Analysis (PCA), t-SNE for dimensionality reduction.
• Feature Engineering: Handling missing values, one-hot encoding, feature scaling (StandardScaler, MinMaxScaler), feature selection, polynomial features.
• Model Evaluation & Validation: Confusion Matrix, Precision, Recall, F1-Score, ROC-AUC, Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), Stratified K-Fold Cross-Validation, diagnosing Bias vs. Variance (overfitting vs. underfitting).`,
    chunkIndex: 2,
  },
  {
    career: 'AI Engineer',
    section: '3. Deep Learning & Neural Network Architectures',
    content: `[roadmap.sh - AI Engineer / Milestone 3: Deep Learning]
• Frameworks: PyTorch (Tensors, Autograd, nn.Module, DataLoader, CUDA acceleration) and TensorFlow / Keras.
• Neural Foundations: Multi-Layer Perceptrons (MLPs), Backpropagation, Activation functions (ReLU, LeakyReLU, GELU, Sigmoid, Softmax), Loss functions (Cross-Entropy, Binary Cross-Entropy, Huber Loss), Optimizers (Adam, AdamW, SGD with Momentum).
• Computer Vision (CV): Convolutional Neural Networks (CNNs), Pooling, Batch Normalization, Dropout, ResNet, EfficientNet, Transfer Learning with torchvision, Object Detection (YOLO).
• Sequence Models: Recurrent Neural Networks (RNNs), Long Short-Term Memory (LSTM), Gated Recurrent Units (GRU), Sequence-to-Sequence models.`,
    chunkIndex: 3,
  },
  {
    career: 'AI Engineer',
    section: '4. Transformers, Large Language Models (LLMs) & GenAI',
    content: `[roadmap.sh - AI Engineer / Milestone 4: Modern NLP & LLMs]
• Transformer Architecture: Self-Attention mechanism, Scaled Dot-Product Attention, Multi-Head Attention, Positional Encoding, Encoder-only (BERT), Decoder-only (GPT, LLaMA, Mistral), Encoder-Decoder (T5).
• Tokenization: Byte-Pair Encoding (BPE), WordPiece, SentencePiece, Hugging Face Tokenizers.
• Pre-training & Fine-Tuning: Masked Language Modeling, Next Token Prediction, Supervised Fine-Tuning (SFT), Parameter-Efficient Fine-Tuning (PEFT, LoRA, QLoRA).
• Alignment & Safety: RLHF (Reinforcement Learning from Human Feedback), DPO (Direct Preference Optimization), AI Guardrails, Prompt Engineering (Few-Shot, Chain-of-Thought, ReAct prompting).`,
    chunkIndex: 4,
  },
  {
    career: 'AI Engineer',
    section: '5. Retrieval-Augmented Generation (RAG) & Vector Databases',
    content: `[roadmap.sh - AI Engineer / Milestone 5: RAG & Knowledge Systems]
• RAG Pipeline Architecture: Query parsing, context retrieval, prompt augmentation, LLM generation, citation generation.
• Ingestion & Chunking: Recursive character splitting, semantic boundary chunking, token-aware chunking, metadata enrichment.
• Vector Embeddings & Indexing: Dense embedding models (text-embedding-3-small, BGE, Cohere), Cosine similarity, Euclidean distance, Dot product, Approximate Nearest Neighbor (ANN) indexing algorithms (HNSW, IVFFlat).
• Vector Databases: pgvector (PostgreSQL extension), Pinecone, ChromaDB, Qdrant, Milvus.
• Advanced RAG Techniques: Hybrid search (Dense vector + BM25 sparse keyword), Re-ranking (Cohere Rerank, Cross-encoders), Self-Querying, Multi-query retrieval, evaluation with RAGAS (Faithfulness, Answer Relevance).`,
    chunkIndex: 5,
  },
  {
    career: 'AI Engineer',
    section: '6. MLOps, Model Serving & Production Engineering',
    content: `[roadmap.sh - AI Engineer / Milestone 6: MLOps & Production]
• Serving & Inference: High-performance inference APIs using FastAPI, BentoML, vLLM (PagedAttention, continuous batching), TensorRT-LLM, Triton Inference Server.
• Containerization: Docker containerization for AI models, CUDA base images, multi-stage Docker builds, Kubernetes for orchestration.
• Experiment Tracking & Model Registries: MLflow, Weights & Biases (W&B) for logging hyperparameters, loss curves, and artifact versioning.
• Pipeline Automation: CI/CD for machine learning (GitHub Actions, CML), Data Version Control (DVC), Apache Airflow for data ingestion workflows.
• Production Monitoring: Tracking latency, token throughput, GPU memory utilization, data drift, concept drift, and model output quality.`,
    chunkIndex: 6,
  },

  // ==========================================
  // 2. BACKEND DEVELOPER (Source: roadmap.sh/backend)
  // ==========================================
  {
    career: 'Backend Developer',
    section: '1. Internet Protocols & Networking Fundamentals',
    content: `[roadmap.sh - Backend Developer / Milestone 1: Internet & Protocols]
• How the Internet Works: IP Addressing (IPv4/IPv6), DNS resolution process, TCP vs UDP, 3-way TCP handshake, sockets, routing.
• HTTP Protocol: HTTP/1.1 vs HTTP/2 (multiplexing) vs HTTP/3 (QUIC/UDP). Request methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD). Status codes (200, 201, 204, 301, 400, 401, 403, 404, 409, 422, 500, 502, 503).
• Headers, Cookies & Security: Content-Type, Authorization, Accept, Cache-Control, CORS (Cross-Origin Resource Sharing), Preflight OPTIONS requests.
• Real-time & RPC Protocols: WebSockets for persistent full-duplex communication, Server-Sent Events (SSE), gRPC and Protocol Buffers for fast microservice communication.`,
    chunkIndex: 1,
  },
  {
    career: 'Backend Developer',
    section: '2. Language Runtimes, Node.js & Frameworks',
    content: `[roadmap.sh - Backend Developer / Milestone 2: Runtime & Frameworks]
• Node.js Internals: V8 JavaScript Engine, Libuv, Single-Threaded Event Loop, Phases (Timers, Pending Callbacks, Poll, Check, Close), Call Stack, Microtasks (process.nextTick, Promise), Macrotasks (setTimeout, setImmediate).
• TypeScript Mastery: Strict mode, interfaces, type aliases, union & intersection types, Generics, mapped types, utility types (Partial, Pick, Omit, Record).
• Backend Frameworks: NestJS (Enterprise-grade architectural patterns, Dependency Injection, Inversion of Control, Modules, Controllers, Services, Pipes, Guards, Interceptors, Custom Decorators) and Express.js (middleware chains).
• Asynchronous Programming: Promises, async/await, error propagation, EventEmitters, Node.js Streams & Buffers for high-throughput I/O.`,
    chunkIndex: 2,
  },
  {
    career: 'Backend Developer',
    section: '3. Relational & NoSQL Database Engineering',
    content: `[roadmap.sh - Backend Developer / Milestone 3: Databases & Caching]
• Relational Databases: PostgreSQL and MySQL. Relational data modeling, Normalization (1NF, 2NF, 3NF), Primary Keys, Foreign Keys with CASCADE/SET NULL, unique constraints.
• SQL & Indexing: Complex JOINs, Subqueries, Aggregations (GROUP BY, HAVING), Indexing strategies (B-Tree, Hash, GIN), Composite indexes, EXPLAIN ANALYZE for query performance tuning.
• Transactions & ACID: Atomicity, Consistency, Isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable), Durability, Deadlock detection.
• ORM & Query Builders: Prisma ORM (schema definition, migrations, type-safe queries, relation queries, transactions) and TypeORM.
• In-Memory & NoSQL: Redis (String, Hash, List, Set, Sorted Set, TTL caching patterns, Cache-Aside, Write-Through, Pub/Sub, distributed locks), MongoDB (document store, collections, indexing).`,
    chunkIndex: 3,
  },
  {
    career: 'Backend Developer',
    section: '4. Authentication, Authorization & Web Security',
    content: `[roadmap.sh - Backend Developer / Milestone 4: Auth & Security]
• Authentication Mechanisms: JSON Web Tokens (JWT) payload, signing algorithms (HS256 vs RS256 asymmetric keys), access token lifespan, Refresh Token rotation with database revocation, Session-based auth with HttpOnly Secure SameSite cookies.
• Authorization & Access Control: Role-Based Access Control (RBAC with Roles and Permissions), Attribute-Based Access Control (ABAC), NestJS Guards and Decorators for endpoint security.
• Protocols: OAuth 2.0 (Authorization Code Grant with PKCE, Client Credentials) and OpenID Connect (OIDC) for SSO.
• Security Hardening: Password hashing with bcrypt/argon2 (salt rounds), Helmet headers, Rate limiting (Throttler), CORS configuration, SQL Injection prevention via parameterized queries, XSS sanitization, CSRF tokens, OWASP Top 10 mitigation.`,
    chunkIndex: 4,
  },
  {
    career: 'Backend Developer',
    section: '5. API Architecture, System Design & Scaling',
    content: `[roadmap.sh - Backend Developer / Milestone 5: System Design & APIs]
• API Paradigms: RESTful API design (resource naming, statelessness, pagination via offset vs cursor), GraphQL (Schemas, Resolvers, Mutations, DataLoader to solve N+1 queries), Webhooks.
• Scalability & Load Balancing: Horizontal vs Vertical scaling, Reverse proxies & Load Balancers (Nginx, HAProxy), round-robin and least-connections routing, SSL/TLS termination.
• Asynchronous Architecture & Message Queues: Message brokers (RabbitMQ, Apache Kafka, Redis Streams), Producer-Consumer pattern, BullMQ for distributed background jobs, event-driven architecture, idempotency.
• Caching Architecture: Content Delivery Networks (CDN), Reverse Proxy Cache, In-memory application cache, Redis cluster, cache invalidation strategies.`,
    chunkIndex: 5,
  },
  {
    career: 'Backend Developer',
    section: '6. DevOps, Docker Containerization & Observability',
    content: `[roadmap.sh - Backend Developer / Milestone 6: DevOps & Observability]
• Containerization: Docker (Dockerfile multi-stage builds, caching layers, Alpine base images, non-root users), Docker Compose for local multi-container development (Node.js + PostgreSQL + Redis).
• Orchestration: Kubernetes concepts (Pods, Deployments, Services, Ingress controllers, Horizontal Pod Autoscaler).
• CI/CD Pipelines: GitHub Actions (linting, automated tests, building Docker images, pushing to container registries, automated deployment).
• Logging & Observability: Structured logging (Winston, Pino) in JSON format, log levels (error, warn, info, debug), Application performance monitoring (APM), Prometheus metrics collection, Grafana dashboards, OpenTelemetry distributed tracing.`,
    chunkIndex: 6,
  },

  // ==========================================
  // 3. FRONTEND DEVELOPER (Source: roadmap.sh/frontend)
  // ==========================================
  {
    career: 'Frontend Developer',
    section: '1. Web Core: HTML5, CSS3 & Accessibility',
    content: `[roadmap.sh - Frontend Developer / Milestone 1: Web Standards & Core]
• Semantic HTML5: Structural elements (<header>, <nav>, <main>, <article>, <section>, <aside>, <footer>), form elements and validations, SEO meta tags, OpenGraph protocol.
• Modern CSS3: Box Model (content, padding, border, margin, box-sizing: border-box), Specificity and Cascade.
• Responsive Layouts: Flexbox (flex direction, justify-content, align-items, flex-wrap, flex-grow/shrink), CSS Grid (grid-template-columns, fr units, minmax, auto-fill, auto-fit, gap), Media Queries, Container Queries.
• Web Accessibility (a11y): WCAG 2.1 AA standards, semantic markup, ARIA attributes (aria-label, aria-expanded, aria-hidden), keyboard focus management, tab order, color contrast compliance.`,
    chunkIndex: 1,
  },
  {
    career: 'Frontend Developer',
    section: '2. JavaScript & TypeScript Deep Dive',
    content: `[roadmap.sh - Frontend Developer / Milestone 2: JS & TypeScript]
• Modern JavaScript (ES6+): Scopes, Lexical scoping, Closures, Hoisting, Prototype Chain, 'this' keyword, Destructuring, Spread/Rest operators, Template Literals, Modules (ESM).
• Browser APIs & DOM: DOM traversal and manipulation, Event bubbling and capturing, Event delegation, LocalStorage, SessionStorage, IndexedDB.
• Asynchronous JavaScript: Event Loop, Microtask queue, Macrotask queue, Promises, async/await, Fetch API, AbortController for cancelling HTTP requests.
• TypeScript for Frontend: Static typing, Interfaces vs Types, Generics, Union/Intersection types, Type assertions, Utility types (Pick, Omit, Partial, Record), Strict mode in tsconfig.json.`,
    chunkIndex: 2,
  },
  {
    career: 'Frontend Developer',
    section: '3. React Ecosystem & Component Architecture',
    content: `[roadmap.sh - Frontend Developer / Milestone 3: React Ecosystem]
• Core React Concepts: Virtual DOM, Reconciliation, JSX, Components (Functional), Props, Unidirectional Data Flow, Component Lifecycle.
• React Hooks: useState, useEffect (lifecycle, dependency arrays, cleanup functions), useRef (DOM refs, mutable values), useMemo, useCallback (performance optimization), useContext, useId, Custom Hooks design.
• State Management: Component local state, React Context API, Global lightweight stores (Zustand, Redux Toolkit), Server state management (TanStack Query / React Query for automatic caching, refetching, mutation lifecycle, and cache invalidation).
• Frameworks: Next.js (App Router, Server Components vs Client Components, SSR, SSG, ISR, API Routes).`,
    chunkIndex: 3,
  },
  {
    career: 'Frontend Developer',
    section: '4. Styling Systems, UI Libraries & Design Systems',
    content: `[roadmap.sh - Frontend Developer / Milestone 4: Modern UI & Styling]
• Utility-First CSS: Tailwind CSS (core utilities, responsive modifiers, hover/focus states, dark mode, custom theme configuration, @apply, arbitrary values).
• Component & Scoped Styling: CSS Modules, PostCSS, Styled-Components / Emotion.
• Headless UI & Primitives: Radix UI primitives, Headless UI, shadcn/ui component patterns, Lucide icons.
• Micro-interactions & Animations: CSS transitions & animations, Framer Motion (motion components, animate, initial, exit, AnimatePresence, layout animations).
• Design Systems: Color palettes (HSL/Hex), Typography scales, spacing tokens, elevations & shadows, responsive component libraries.`,
    chunkIndex: 4,
  },
  {
    career: 'Frontend Developer',
    section: '5. Build Tools, Routing & Client-Server Integration',
    content: `[roadmap.sh - Frontend Developer / Milestone 5: Build Tools & Client Flow]
• Modern Build Tools: Vite (esbuild native ESM, lightning-fast Hot Module Replacement, production Rollup bundling), package managers (npm, pnpm, yarn).
• Client-Side Routing: React Router 6/7 (BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useSearchParams, protected route guards).
• API Integration: Axios (HTTP client, baseURL, request interceptors for Authorization Bearer tokens, response interceptors for 401 handling, error normalizing), TanStack Query hooks.
• Form Handling: Controlled vs Uncontrolled inputs, React Hook Form (validation, performance, register, watch), Schema validation with Zod / Yup.`,
    chunkIndex: 5,
  },
  {
    career: 'Frontend Developer',
    section: '6. Web Performance, Testing & Security',
    content: `[roadmap.sh - Frontend Developer / Milestone 6: Performance & Testing]
• Core Web Vitals: Largest Contentful Paint (LCP), Interaction to Next Paint (INP), Cumulative Layout Shift (CLS), First Input Delay (FID).
• Performance Optimization: Code splitting (React.lazy, dynamic import), Tree shaking, Asset compression, Image optimization (WebP, AVIF, lazy loading), Bundle analyzers.
• Frontend Testing: Unit and Component testing with Vitest / Jest and React Testing Library (render, screen, fireEvent, userEvent, expect), End-to-End (E2E) testing with Playwright / Cypress.
• Frontend Security: Cross-Site Scripting (XSS) prevention, sanitizing dangerous HTML, Content Security Policy (CSP), avoiding sensitive data in localStorage, CORS handling.`,
    chunkIndex: 6,
  },

  // ==========================================
  // 4. FULL STACK DEVELOPER (Source: roadmap.sh/full-stack)
  // ==========================================
  {
    career: 'Full Stack Developer',
    section: '1. Frontend Client Architecture & Modern UI',
    content: `[roadmap.sh - Full Stack Developer / Milestone 1: Client Architecture]
• Web Fundamentals: HTML5 semantics, modern responsive CSS3 (Flexbox & Grid), mobile-first viewport design.
• Client Framework: React with TypeScript, modular component architecture, reusable UI building blocks.
• Client State Architecture: Distinguishing local UI state (useState) from persistent global state (Zustand/Context) and server cache (TanStack Query).
• Design System: Tailwind CSS styling, consistent color tokens, accessible micro-interactions, responsive navigation bars, modals, and data tables.`,
    chunkIndex: 1,
  },
  {
    career: 'Full Stack Developer',
    section: '2. Server-Side Engineering & RESTful APIs',
    content: `[roadmap.sh - Full Stack Developer / Milestone 2: Server-Side & APIs]
• Backend Architecture: Node.js and TypeScript runtime with NestJS or Express. Controller-Service-Repository structural pattern.
• REST API Design: Resource-based routing, HTTP verb semantics, DTO (Data Transfer Object) validation with class-validator and class-transformer, global validation pipes.
• Error Handling: Centralized exception filters, standardized JSON error responses with status codes, error logging.
• Middleware & Interceptors: Request logging middleware, response transformation interceptors, timing interceptors.`,
    chunkIndex: 2,
  },
  {
    career: 'Full Stack Developer',
    section: '3. Relational Database Modeling & ORM Integration',
    content: `[roadmap.sh - Full Stack Developer / Milestone 3: Databases & ORM]
• Database Management: PostgreSQL relational database design, relational schema diagrams (1:1, 1:N, N:M relations).
• Schema Evolution & ORM: Prisma ORM (schema.prisma modeling, migrations with prisma migrate, prisma client generation, seeding with seed.ts).
• Query Optimization: Prisma include / select queries to prevent over-fetching, database indexing on foreign keys and search fields, atomic transactions with prisma.$transaction.
• In-Memory Cache: Redis caching for high-read endpoints, session stores, and rate limiting.`,
    chunkIndex: 3,
  },
  {
    career: 'Full Stack Developer',
    section: '4. End-to-End Authentication, Security & RBAC',
    content: `[roadmap.sh - Full Stack Developer / Milestone 4: Full Stack Auth & Security]
• Auth Flows: User registration, secure password hashing using bcrypt, credential verification, JWT token issuance.
• Token Transport & Management: JWT Bearer tokens in Authorization headers, token storage strategies, Refresh Token exchange workflows.
• Server-Side Protection: Passport JWT strategy, NestJS AuthGuard, custom @CurrentUser() decorators, Role-Based Access Control (RBAC) with RolesGuard for Admin and Student privileges.
• Client-Side Security: Protected route wrappers in React Router, Axios request interceptors that inject JWT tokens into headers, 401 response interceptors that trigger automatic logout and redirect.`,
    chunkIndex: 4,
  },
  {
    career: 'Full Stack Developer',
    section: '5. Client-Server Data Flow & State Synchronization',
    content: `[roadmap.sh - Full Stack Developer / Milestone 5: Full Stack Data Flow]
• API Communication: Typed Axios HTTP client instance, centralized API service modules matching backend endpoints.
• Real-Time & Bidirectional Communication: WebSockets (Socket.io) or Server-Sent Events (SSE) for live chat messages, real-time alerts, and interactive notifications.
• Optimistic UI Updates: Updating frontend UI immediately before server confirmation, rolling back on error.
• Shared Types & Contracts: Shared TypeScript interfaces for User, Grade, Attendance, Class, and AI Response objects across frontend and backend.`,
    chunkIndex: 5,
  },
  {
    career: 'Full Stack Developer',
    section: '6. Containerization, DevOps & Production Deployment',
    content: `[roadmap.sh - Full Stack Developer / Milestone 6: Deployment & DevOps]
• Docker Containerization: Multi-stage Dockerfiles for frontend (Node build stage + Nginx static server) and backend (Node build stage + production runtime). Docker Compose for multi-container orchestration.
• Environment Management: Staging and production environment variables (.env), secrets management.
• CI/CD Pipelines: GitHub Actions workflows for automated code linting, typechecking, building, and automated deployment.
• Production Infrastructure: Reverse proxy configuration with Nginx, SSL/TLS certificates via Let's Encrypt / Certbot, process management with PM2 / Docker, cloud deployment to VPS, AWS, or Vercel.`,
    chunkIndex: 6,
  },
];

async function main() {
  console.log('Seeding Roadmap chunks from roadmap.sh...');

  // Delete existing roadmap chunks
  await prisma.roadmapChunk.deleteMany({});

  for (const chunk of roadmapData) {
    await prisma.roadmapChunk.create({
      data: chunk,
    });
  }

  const count = await prisma.roadmapChunk.count();
  console.log(`✅ Successfully seeded ${count} roadmap chunks across AI Engineer, Backend Developer, Frontend Developer, and Full Stack Developer!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding roadmaps:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
