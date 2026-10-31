<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a2b4a,100:e85d2c&height=220&section=header&text=HACKORA&fontSize=64&fontColor=ffffff&fontAlignY=35&desc=From%20Ideas%20to%20Innovation%20—%20AI-Powered%20Hackathon%20Companion&descAlignY=55&descSize=18&animation=fadeIn" width="100%"/>

<br/>

<a href="#">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=20&duration=3000&pause=1000&color=E85D2C&center=true&vCenter=true&width=700&lines=From+Ideas+to+Innovation.;Stage+1%3A+Explore+%26+Plan+with+Multi-LLM+BYOK;Stage+2%3A+Analyze+%26+Defend+Your+Codebase;Judge-ready+architectures%2C+diagrams%2C+and+blueprints." alt="Typing SVG" />
</a>

<br/><br/>

<img src="https://img.shields.io/badge/status-live-10b981?style=for-the-badge&labelColor=1a2b4a"/>
<img src="https://img.shields.io/badge/stage-1%20%26%202%20ready-e85d2c?style=for-the-badge&labelColor=1a2b4a"/>
<img src="https://img.shields.io/badge/license-MIT-8B5CF6?style=for-the-badge&labelColor=1a2b4a"/>

<br/><br/>

### 🔗 [**Live Demo**](https://dev-lens-ai-sage.vercel.app) &nbsp;·&nbsp; [**GitHub Repo**](https://github.com/<user-Rishabh>/DevLens-AI)

<sub>Hosted on Render & Vercel — backend sleeps after inactivity; initial cold-start may take 30–45s.</sub>

<br/>

<img src="https://skillicons.dev/icons?i=react,vite,tailwind,fastapi,python,supabase,postgres,ts,nodejs,git&theme=dark" />

</div>

<br/>

## What is HACKORA?

**HACKORA** is an **AI-powered hackathon companion** designed to take builders from early problem statements to judge-defended projects with zero guesswork. 

> **"From Ideas to Innovation."**  
> Your AI-powered workspace to research, plan, build, and defend hackathon projects.

Unlike superficial chatbots or wrapper tools, HACKORA is structured into two purpose-built execution stages:

---

### 🚀 Stage 1 — Explore & Plan

Transform raw problem statements or early innovation ideas into structured, build-ready project foundations:

- 📋 **Forensic Problem Statement Breakdown**: Ingest PDFs, DOCX, TXT, or markdown briefs. HACKORA extracts requirements, constraints, target users, and success criteria without hallucinating unmentioned facts.
- 💡 **Open Innovation Discovery**: Research competitors and existing approaches, discover unaddressed user pain points, and surface defensible Unique Selling Propositions (USPs).
- 💬 **Conversational AI Workspace (BYOK)**: Multi-LLM provider support (OpenAI, Anthropic Claude, Google Gemini, Moonshot Kimi, Groq, OpenRouter). Bring your own API key with secure client-side encryption and zero backend key logging.
- 📐 **On-Demand Technical Blueprints**: Generate 3-way solution comparison matrices, Mermaid architecture diagrams, database schemas, API specs, and full pitch deck blueprints with golden demo paths.

---

### 🛡️ Stage 2 — Analyze & Defend

Paste any GitHub repository URL to verify what your project actually implements and prepare for technical judging:

- 🗂️ **Navigable File Structure**: Instant file tree filtering out lockfiles and build noise.
- 🤖 **AI File Explanations**: Cached plain-English module explanations.
- 🔍 **Hybrid Semantic Search (Ask HACKORA)**: Keyword (full-text BM25) + dense vector embeddings fused via Reciprocal Rank Fusion (RRF) for grounded code answers citing files and lines.
- 🗺️ **Interactive Architecture Map**: Live React Flow dependency graph highlighting critical paths and churn hotspots.
- 📊 **Code Quality Score & Blast Radius**: Churn, complexity, and transitive dependency analysis ("what breaks if I change this?").
- ⚖️ **Forensic Requirement Audit & Defense Prep**: Verify whether features in the problem statement exist in code and simulate rigorous judge cross-examinations.

---

<br/>

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=rect&color=0:e85d2c,100:1a2b4a&height=3&width=100%"/>
</div>

<br/>

## 🏗️ Architecture

```
                    ┌─────────────────────────┐
                    │    HACKORA Workspace    │
                    └────────────┬─────────────┘
                                 ▼
         ┌───────────────────────┴────────────────────────┐
         ▼                                                ▼
┌─────────────────────────┐                      ┌─────────────────────────┐
│   Stage 1: Explore      │                      │   Stage 2: Defend       │
│   & Plan Workspace      │                      │   & Analyze Codebase    │
└────────────┬────────────┘                      └────────────┬────────────┘
             ▼                                                ▼
┌─────────────────────────┐                      ┌─────────────────────────┐
│ Multi-LLM BYOK Gateway  │                      │ AST Parser & Git Mining │
│ (OpenAI, Claude, Groq,  │                      │ (tree-sitter, GitPython,│
│  Gemini, Kimi, Router)  │                      │  sentence-transformers) │
└────────────┬────────────┘                      └────────────┬────────────┘
             ▼                                                ▼
┌─────────────────────────┐                      ┌─────────────────────────┐
│ Structured Blueprints,  │                      │ Supabase pgvector + RRF │
│ Diagrams, Pitch Decks   │                      │ Grounded Q&A + Audit    │
└─────────────────────────┘                      └─────────────────────────┘
```

<br/>

## ⚙️ Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · Vite · TypeScript · Tailwind CSS · React Flow · Lucide |
| **Backend** | Python 3.12 · FastAPI · Uvicorn |
| **Database** | Supabase (PostgreSQL + pgvector + GIN Full-Text Indexing) |
| **AST Parsing** | tree-sitter (Python, JS, TS/TSX) |
| **Embeddings** | sentence-transformers (`all-MiniLM-L6-v2`) |
| **AI Providers** | OpenAI · Anthropic · Google Gemini · Moonshot AI · Groq · OpenRouter |
| **Git Analysis** | GitPython · AST import resolution |

</div>

<br/>

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/<your-username>/DevLens-AI.git
cd DevLens-AI

# Backend setup
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows (.venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
cp .env.example .env          # Add your Supabase + Groq/AI provider keys
python app/main.py

# Frontend setup (separate terminal)
cd frontend
npm install
cp .env.example .env          # Set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

<br/>

## ☁️ Deployment

- **Frontend**: [Vercel](https://vercel.com)
- **Backend**: [Render](https://render.com)

<br/>

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:e85d2c,100:1a2b4a&height=120&section=footer"/>

**HACKORA — From Ideas to Innovation.**

</div>
