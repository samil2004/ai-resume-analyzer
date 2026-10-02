# Matchwork

Matchwork is a local-first resume-to-role matching app designed for quick career decision-making. It helps a user compare their current skill set against a job description, identify overlaps and gaps, and save promising roles for later review.

This project is intentionally lightweight: the frontend is a single-page interface, the backend is FastAPI, and the data layer uses SQLAlchemy with SQLite by default. It works as a practical prototype for portfolio demos, personal career planning, and early-stage product exploration.

## What it does

- Creates a local account with sign-up and sign-in
- Stores a user profile and resume skills
- Compares a resume skill list against a job description
- Calculates a fit score using keyword overlap
- Highlights matched skills and missing skills
- Saves comparison results for later viewing
- Shows recurring skill gaps across saved roles

## Why this project exists

Most resume-matching tools feel heavy, impersonal, or locked behind large platforms. Matchwork aims to be the opposite: a small, private workspace where someone can test how their experience aligns with a target role without needing a full SaaS stack.

It is especially useful for:

- role discovery
- resume planning
- learning path suggestions
- portfolio or prototype demos
- personal career analysis

## Tech stack

- Python 3
- FastAPI
- SQLAlchemy
- SQLite
- Vanilla JavaScript
- HTML and CSS
- Docker support for optional containerized runs

## Project structure

```text
.
├── main.py               # FastAPI app and route definitions
├── models.py             # SQLAlchemy models
├── database.py           # Database setup and session creation
├── static/
│   ├── index.html        # Frontend structure
│   ├── styles.css        # Styling and layout
│   └── app.js            # UI logic and API calls
├── requirements.txt      # Python dependencies
├── compose.yaml          # Docker Compose configuration
├── Dockerfile            # App container definition
├── README.md             # Project documentation
├── resume_analyzer.db    # Local SQLite database (if created locally)
└── .env.example          # Example environment variables for Docker use
```

## Local setup

### 1) Create a virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2) Install dependencies

```powershell
pip install -r requirements.txt
```

### 3) Start the application

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open:

- http://localhost:8000
- http://localhost:8000/docs for the API docs

## Docker run

This project includes a Compose setup for a containerized workflow.

```powershell
docker compose up --build
```

Open the app at http://localhost:8000.

To stop the containers:

```powershell
docker compose down
```

## Current status

This is a functional prototype, not a production-grade hiring platform.

Current behavior:

- skill matching is based on a built-in keyword catalog
- resume parsing from PDF is not implemented yet
- AI-powered recommendation logic is not connected yet
- authentication is local-session based and designed for prototype use

## Example workflow

1. Create an account
2. Add resume skills
3. Paste a job description
4. Review the matched and missing skills
5. Save the role to your shortlist
6. Revisit the skill map to track recurring gaps

## Notes

The app is designed to be simple, private, and easy to run locally. It emphasizes user experience and product thinking over enterprise complexity.

If you are using this project as a prototype or portfolio item, it is a strong foundation for adding:

- PDF resume upload
- LLM-based skill extraction
- richer scoring models
- job search integrations
- analytics and reporting
- production-grade authentication

## License

This project is intended for learning and personal use. Add a license file if you plan to share it publicly or use it beyond your own workspace.