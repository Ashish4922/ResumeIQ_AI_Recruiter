# ResumeIQ AI Recruiter

> AI-powered resume analysis and recruitment platform for candidates and recruiters.

ResumeIQ is a full-stack recruitment platform that combines **AI-powered resume analysis, ATS evaluation, job matching, candidate screening, interview management, and recruiter workflows** into a single application.

The platform provides separate experiences for candidates and recruiters, helping candidates understand and improve their resumes while giving recruiters tools to manage jobs, screen candidates, compare applicants, and organize interviews.

---

## 🚀 Features

### 👤 Candidate

- User registration and login
- Resume upload and analysis
- AI-powered resume evaluation
- ATS compatibility analysis
- Resume quality scoring
- Missing keyword identification
- Resume improvement recommendations
- Skill upgrade recommendations
- Job description analysis
- Resume-to-job matching
- Skills, experience, and education matching
- Matched and missing skills identification
- Analysis history
- Credit-based AI analysis system

### 👨‍💼 Recruiter

- Dedicated recruiter authentication
- Recruiter dashboard
- Create, edit, and delete job postings
- Upload multiple candidate resumes
- AI-powered candidate screening
- Candidate match scoring
- Skills, experience, and education matching
- Matched and missing skills
- Candidate review workflow
- Candidate status management
  - Review
  - Shortlisted
  - Interview
  - Rejected
- Candidate comparison
- AI-generated interview questions
- Interview scheduling
- Interviewer management
- Interview status management
  - Scheduled
  - Completed
  - Cancelled
- Interview notes
- Upcoming interview management
- CSV job reports

---

## 🧠 AI Capabilities

ResumeIQ uses Google's Gemini API for AI-powered analysis.

The AI layer is used for:

- Resume information extraction
- Resume quality analysis
- ATS evaluation
- Job description analysis
- Resume-job matching
- Skill gap identification
- Candidate screening
- Interview question generation
- Resume improvement recommendations

The application is designed as a **decision-support system**. AI-generated scores and recommendations are intended to assist candidates and recruiters rather than replace human judgment.

---

## 🏗️ System Architecture

```text
                         ResumeIQ
                            │
              ┌─────────────┴─────────────┐
              │                           │
          Candidate                   Recruiter
              │                           │
              └─────────────┬─────────────┘
                            │
                     Frontend Layer
                    HTML / CSS / JS
                            │
                            ▼
                    FastAPI Backend
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        Authentication    SQLite       Gemini API
             │              │              │
             └──────────────┴──────────────┘
                            │
                            ▼
                    Analysis & Results