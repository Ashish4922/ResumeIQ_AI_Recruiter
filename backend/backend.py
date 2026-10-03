from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    UploadFile,
    File,
    Form
)

from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, EmailStr

from typing import Literal

import os
import csv
import io

from fastapi.responses import StreamingResponse


from backend.gemini_service import (
    save_uploaded_file,
    analyze_resume,
    analyze_job_match,
    generate_interview_questions
)

from backend.database import (
    init_database,
    create_user,
    get_user_by_email,
    get_user_by_id,
    consume_analysis,
    save_analysis_history,
    get_analysis_history,
    create_job,
    get_jobs_by_recruiter,
    get_job_by_id,
    delete_job,
    update_job,
    get_job_candidate_by_filename,
    get_job_candidate_by_id,
    update_job_candidate_status,
    create_job_candidate,
    get_job_candidates,
    update_job_candidate_screening,
    update_job_candidate_notes,
    update_job_candidate_interview_questions,
    update_job_candidate_interview
)

from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token
)


app = FastAPI(
    title="ResumeIQ API",
    version="1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://resumeiq-frontend-rzjv.onrender.com"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


security = HTTPBearer()


init_database()


class RegisterRequest(BaseModel):

    name: str
    email: EmailStr
    password: str
    role: Literal[
        "candidate",
        "recruiter"
    ] = "candidate"


class LoginRequest(BaseModel):

    email: EmailStr
    password: str


class JobCreateRequest(BaseModel):

    title: str
    company: str
    location: str = ""
    experience: str = ""
    description: str


class CandidateStatusRequest(BaseModel):

    status: Literal[
        "review",
        "shortlisted",
        "interview",
        "rejected"
    ]


class CandidateNotesRequest(BaseModel):

    notes: str


class InterviewQuestionsRequest(BaseModel):

    questions: list[str]


class InterviewRequest(BaseModel):

    interview_date: str = ""
    interview_time: str = ""

    interview_type: Literal[
        "online",
        "in-person",
        "phone"
    ] = "online"

    interviewer: str = ""

    interview_status: Literal[
        "scheduled",
        "completed",
        "cancelled"
    ] = "scheduled"

    interview_notes: str = ""


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    payload = decode_token(token)

    if not payload:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if not user_id:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = get_user_by_id(
        int(user_id)
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


def require_recruiter(
    user=Depends(get_current_user)
):

    if user["role"] != "recruiter":

        raise HTTPException(
            status_code=403,
            detail="Recruiter access required"
        )

    return user


@app.get("/")
def root():

    return {
        "message": "ResumeIQ backend is running"
    }


@app.post("/register")
def register(
    data: RegisterRequest
):

    existing_user = get_user_by_email(
        data.email
    )

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    if len(data.password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters"
        )

    hashed_password = hash_password(
        data.password
    )

    user_id = create_user(
        data.name,
        data.email,
        hashed_password,
        data.role
    )

    token = create_access_token(
        user_id
    )

    return {
        "message": "Registration successful",
        "token": token,
        "user": {
            "id": user_id,
            "name": data.name,
            "email": data.email,
            "role": data.role
        }
    }


@app.post("/login")
def login(
    data: LoginRequest
):

    user = get_user_by_email(
        data.email
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user["password"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(
        user["id"]
    )

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }


@app.get("/me")
def me(
    user=Depends(get_current_user)
):

    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "free_credits": user["free_credits"],
        "paid_balance": user["paid_balance"],
        "total_analyses": user["total_analyses"]
    }


@app.get("/credits")
def credits(
    user=Depends(get_current_user)
):

    return {
        "free_credits": user["free_credits"],
        "paid_balance": user["paid_balance"],
        "price_per_analysis": 10,
        "total_analyses": user["total_analyses"]
    }


@app.post("/consume-analysis")
def consume(
    user=Depends(get_current_user)
):

    result = consume_analysis(
        user["id"]
    )

    if not result["allowed"]:

        raise HTTPException(
            status_code=402,
            detail={
                "message": "Free credits exhausted",
                "price": 10,
                "reason": "Payment required"
            }
        )

    return result


@app.post("/analyze-resume")
def analyze_resume_endpoint(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):

    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg"
    }

    filename = file.filename or ""

    extension = os.path.splitext(
        filename
    )[1].lower()

    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail="Unsupported resume format."
        )

    temporary_file = None

    try:

        temporary_file = save_uploaded_file(
            file
        )

        result = analyze_resume(
            temporary_file,
            extension.replace(".", "")
        )

        credit_result = consume_analysis(
            user["id"]
        )

        if not credit_result["allowed"]:

            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Free credits exhausted",
                    "price": 10,
                    "reason": "Payment required"
                }
            )

        save_analysis_history(
            user["id"],
            "Resume Analysis",
            filename,
            result.resume_quality.score
        )

        return {
            "message": "Resume analyzed successfully",
            "credit": credit_result,
            "analysis": result.model_dump()
        }

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if temporary_file:

            try:

                os.remove(
                    temporary_file
                )

            except Exception:

                pass


@app.post("/analyze-job")
def analyze_job_endpoint(
    file: UploadFile = File(...),
    job_description: str = Form(...),
    user=Depends(get_current_user)
):

    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg"
    }

    filename = file.filename or ""

    extension = os.path.splitext(
        filename
    )[1].lower()

    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail="Unsupported resume format."
        )

    if not job_description.strip():

        raise HTTPException(
            status_code=400,
            detail="Job description cannot be empty."
        )

    temporary_file = None

    try:

        temporary_file = save_uploaded_file(
            file
        )

        result = analyze_job_match(
            temporary_file,
            extension.replace(".", ""),
            job_description
        )

        credit_result = consume_analysis(
            user["id"]
        )

        if not credit_result["allowed"]:

            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Free credits exhausted",
                    "price": 10,
                    "reason": "Payment required"
                }
            )

        save_analysis_history(
            user["id"],
            "Job Analysis",
            filename,
            result.match_score
        )

        return {
            "message": "Job analyzed successfully",
            "credit": credit_result,
            "analysis": result.model_dump()
        }

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if temporary_file:

            try:

                os.remove(
                    temporary_file
                )

            except Exception:

                pass


@app.get("/history")
def history(
    user=Depends(get_current_user)
):

    records = get_analysis_history(
        user["id"]
    )

    return {
        "history": [
            {
                "id": record["id"],
                "analysis_type": record["analysis_type"],
                "file_name": record["file_name"],
                "score": record["score"],
                "created_at": record["created_at"]
            }
            for record in records
        ]
    }


@app.post("/jobs")
def create_job_endpoint(
    data: JobCreateRequest,
    user=Depends(require_recruiter)
):

    if not data.title.strip():

        raise HTTPException(
            status_code=400,
            detail="Job title is required."
        )

    if not data.company.strip():

        raise HTTPException(
            status_code=400,
            detail="Company name is required."
        )

    if not data.description.strip():

        raise HTTPException(
            status_code=400,
            detail="Job description is required."
        )

    job_id = create_job(
        user["id"],
        data.title.strip(),
        data.company.strip(),
        data.location.strip(),
        data.experience.strip(),
        data.description.strip()
    )

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    return {
        "message": "Job created successfully",
        "job": {
            "id": job["id"],
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "experience": job["experience"],
            "description": job["description"],
            "status": job["status"],
            "created_at": job["created_at"]
        }
    }


@app.get("/jobs")
def get_jobs(
    user=Depends(require_recruiter)
):

    jobs = get_jobs_by_recruiter(
        user["id"]
    )

    return {
        "jobs": [
            {
                "id": job["id"],
                "title": job["title"],
                "company": job["company"],
                "location": job["location"],
                "experience": job["experience"],
                "description": job["description"],
                "status": job["status"],
                "created_at": job["created_at"]
            }
            for job in jobs
        ]
    }


@app.get("/jobs/{job_id}")
def get_job(
    job_id: int,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    return {
        "job": {
            "id": job["id"],
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "experience": job["experience"],
            "description": job["description"],
            "status": job["status"],
            "created_at": job["created_at"]
        }
    }


@app.delete("/jobs/{job_id}")
def delete_job_endpoint(
    job_id: int,
    user=Depends(require_recruiter)
):


    deleted = delete_job(
        job_id,
        user["id"]
    )

class JobUpdateRequest(BaseModel):
    title: str
    company: str
    location: str = ""
    experience: str = ""
    description: str


@app.patch("/jobs/{job_id}")
def update_job_endpoint(
    job_id: int,
    data: JobUpdateRequest,
    user=Depends(require_recruiter)
):
    if not data.title.strip():
        raise HTTPException(
            status_code=400,
            detail="Job title is required."
        )

    if not data.company.strip():
        raise HTTPException(
            status_code=400,
            detail="Company name is required."
        )

    if not data.description.strip():
        raise HTTPException(
            status_code=400,
            detail="Job description is required."
        )

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    updated = update_job(
        job_id,
        user["id"],
        data.title.strip(),
        data.company.strip(),
        data.location.strip(),
        data.experience.strip(),
        data.description.strip()
    )

    if not updated:
        raise HTTPException(
            status_code=400,
            detail="Could not update job."
        )

    updated_job = get_job_by_id(
        job_id,
        user["id"]
    )

    return {
        "message": "Job updated successfully",
        "job": {
            "id": updated_job["id"],
            "title": updated_job["title"],
            "company": updated_job["company"],
            "location": updated_job["location"],
            "experience": updated_job["experience"],
            "description": updated_job["description"],
            "status": updated_job["status"],
            "created_at": updated_job["created_at"]
        }
    }



    if not deleted:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    return {
        "message": "Job deleted successfully"
    }


@app.get("/jobs/{job_id}/candidates")
def get_candidates(
    job_id: int,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    candidates = get_job_candidates(
        job_id
    )

    return {
        "job": {
            "id": job["id"],
            "title": job["title"],
            "company": job["company"]
        },
        "candidates": [
            {
                "id": candidate["id"],
                "candidate_name": candidate["candidate_name"],
                "candidate_email": candidate["candidate_email"],
                "resume_filename": candidate["resume_filename"],
                "match_score": candidate["match_score"],
                "skills_match": candidate["skills_match"],
                "experience_match": candidate["experience_match"],
                "education_match": candidate["education_match"],
                "matched_skills": candidate["matched_skills"],
                "missing_skills": candidate["missing_skills"],
                "status": candidate["status"],
                "notes": candidate["notes"],
                "interview_questions": candidate["interview_questions"],
                "interview_date": candidate["interview_date"],
                "interview_time": candidate["interview_time"],
                "interview_type": candidate["interview_type"],
                "interviewer": candidate["interviewer"],
                "interview_status": candidate["interview_status"],
                "interview_notes": candidate["interview_notes"],
                "created_at": candidate["created_at"]
            }
            for candidate in candidates
        ]
    }


@app.post("/jobs/{job_id}/candidates")
async def add_candidate(
    job_id: int,
    candidate_name: str = Form(""),
    candidate_email: str = Form(""),
    file: UploadFile = File(...),
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    filename = file.filename or ""

    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg"
    }

    extension = os.path.splitext(
        filename
    )[1].lower()

    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail="Unsupported resume format."
        )

    upload_directory = os.path.join(
        "uploads",
        "jobs",
        str(job_id)
    )

    os.makedirs(
        upload_directory,
        exist_ok=True
    )

    safe_filename = os.path.basename(
        filename
    )

    file_path = os.path.join(
        upload_directory,
        safe_filename
    )

    content = await file.read()

    with open(
        file_path,
        "wb"
    ) as output_file:

        output_file.write(
            content
        )

    candidate_id = create_job_candidate(
        job_id,
        candidate_name.strip(),
        candidate_email.strip(),
        safe_filename,
        file_path
    )

    return {
        "message": "Candidate added successfully",
        "candidate": {
            "id": candidate_id,
            "job_id": job_id,
            "candidate_name": candidate_name.strip(),
            "candidate_email": candidate_email.strip(),
            "resume_filename": safe_filename
        }
    }


@app.post("/jobs/{job_id}/upload-resumes")
async def upload_resumes(
    job_id: int,
    files: list[UploadFile] = File(...),
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )


    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg"
    }


    upload_directory = os.path.join(
        "uploads",
        "jobs",
        str(job_id)
    )

    os.makedirs(
        upload_directory,
        exist_ok=True
    )


    results = []

    pending_candidates = []


    # -----------------------------------------
    # STEP 1: Save and prepare all resumes
    # -----------------------------------------

    for file in files:

        filename = file.filename or ""

        extension = os.path.splitext(
            filename
        )[1].lower()


        if extension not in allowed_extensions:

            results.append({
                "candidate_name": "",
                "resume_filename": filename,
                "status": "invalid_format",
                "error": "Unsupported resume format."
            })

            continue


        safe_filename = os.path.basename(
            filename
        )


        existing_candidate = (
            get_job_candidate_by_filename(
                job_id,
                safe_filename
            )
        )


        if existing_candidate:

            results.append({
                "id": existing_candidate["id"],
                "candidate_name":
                    existing_candidate["candidate_name"],
                "resume_filename":
                    safe_filename,
                "status": "duplicate",
                "message":
                    "This resume has already been uploaded for this job."
            })

            continue


        file_path = os.path.join(
            upload_directory,
            safe_filename
        )


        content = await file.read()


        with open(
            file_path,
            "wb"
        ) as output_file:

            output_file.write(
                content
            )


        candidate_name = os.path.splitext(
            safe_filename
        )[0]


        candidate_name = (
            candidate_name
            .replace("_", " ")
            .replace("-", " ")
        )


        candidate_id = create_job_candidate(
            job_id,
            candidate_name,
            "",
            safe_filename,
            file_path
        )


        pending_candidates.append({
            "id": candidate_id,
            "candidate_name": candidate_name,
            "resume_filename": safe_filename,
            "file_path": file_path,
            "extension": extension.replace(".", "")
        })


    # -----------------------------------------
    # STEP 2: AI screening
    # Maximum 2 resumes at the same time
    # -----------------------------------------

    def screen_candidate(candidate):

        try:

            analysis = analyze_job_match(
                candidate["file_path"],
                candidate["extension"],
                job["description"]
            )


            return {
                "success": True,
                "candidate": candidate,
                "analysis": analysis
            }


        except Exception as error:

            return {
                "success": False,
                "candidate": candidate,
                "error": str(error)
            }


    with ThreadPoolExecutor(
        max_workers=2
    ) as executor:

        futures = [
            executor.submit(
                screen_candidate,
                candidate
            )
            for candidate in pending_candidates
        ]


        for future in as_completed(futures):

            result = future.result()

            candidate = result["candidate"]


            # ---------------------------------
            # Successful screening
            # ---------------------------------

            if result["success"]:

                analysis = result["analysis"]


                update_job_candidate_screening(
                    candidate["id"],
                    analysis.match_score,
                    analysis.skills_match,
                    analysis.experience_match,
                    analysis.education_match,
                    ", ".join(
                        analysis.matched_skills
                    ),
                    ", ".join(
                        analysis.missing_skills
                    )
                )


                update_job_candidate_status(
                    candidate["id"],
                    "review"
                )


                results.append({
                    "id": candidate["id"],
                    "candidate_name":
                        candidate["candidate_name"],
                    "resume_filename":
                        candidate["resume_filename"],
                    "match_score":
                        analysis.match_score,
                    "skills_match":
                        analysis.skills_match,
                    "experience_match":
                        analysis.experience_match,
                    "education_match":
                        analysis.education_match,
                    "matched_skills":
                        analysis.matched_skills,
                    "missing_skills":
                        analysis.missing_skills,
                    "summary":
                        analysis.summary,
                    "status": "review"
                })


            # ---------------------------------
            # Failed screening
            # ---------------------------------

            else:

                update_job_candidate_status(
                    candidate["id"],
                    "screening_failed"
                )


                results.append({
                    "id": candidate["id"],
                    "candidate_name":
                        candidate["candidate_name"],
                    "resume_filename":
                        candidate["resume_filename"],
                    "status":
                        "screening_failed",
                    "error":
                        result["error"]
                })


    # -----------------------------------------
    # STEP 3: Validate result
    # -----------------------------------------

    if not results:

        raise HTTPException(
            status_code=400,
            detail="No valid resume files were uploaded."
        )


    return {
        "message":
            "AI screening completed",
        "count":
            len(results),
        "candidates":
            results
    }

@app.patch(
    "/jobs/{job_id}/candidates/{candidate_id}/status"
)
def update_candidate_status(
    job_id: int,
    candidate_id: int,
    data: CandidateStatusRequest,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    candidate = get_job_candidate_by_id(
        candidate_id,
        job_id
    )

    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    update_job_candidate_status(
        candidate_id,
        data.status
    )

    return {
        "message": "Candidate status updated successfully",
        "candidate_id": candidate_id,
        "status": data.status
    }


@app.patch(
    "/jobs/{job_id}/candidates/{candidate_id}/notes"
)
def update_candidate_notes(
    job_id: int,
    candidate_id: int,
    data: CandidateNotesRequest,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    candidate = get_job_candidate_by_id(
        candidate_id,
        job_id
    )

    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    update_job_candidate_notes(
        candidate_id,
        data.notes
    )

    return {
        "message": "Candidate notes updated successfully",
        "candidate_id": candidate_id,
        "notes": data.notes
    }


@app.patch(
    "/jobs/{job_id}/candidates/{candidate_id}/interview-questions"
)
def update_interview_questions(
    job_id: int,
    candidate_id: int,
    data: InterviewQuestionsRequest,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    candidate = get_job_candidate_by_id(
        candidate_id,
        job_id
    )

    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    questions = [
        question.strip()
        for question in data.questions
        if question.strip()
    ]

    update_job_candidate_interview_questions(
        candidate_id,
        "\n".join(questions)
    )

    return {
        "message": "Interview questions saved successfully",
        "candidate_id": candidate_id,
        "questions": questions
    }


@app.post(
    "/jobs/{job_id}/candidates/{candidate_id}/generate-interview-questions"
)
def generate_candidate_interview_questions(
    job_id: int,
    candidate_id: int,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    candidate = get_job_candidate_by_id(
        candidate_id,
        job_id
    )

    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    resume_path = candidate["resume_path"]

    if not resume_path:

        raise HTTPException(
            status_code=400,
            detail="Resume file not found."
        )

    if not os.path.exists(resume_path):

        raise HTTPException(
            status_code=404,
            detail="Resume file no longer exists."
        )

    try:

        extension = os.path.splitext(
            resume_path
        )[1].replace(
            ".",
            ""
        ).lower()

        questions = generate_interview_questions(
            resume_path,
            extension,
            job["description"],
            candidate["matched_skills"] or "",
            candidate["missing_skills"] or ""
        )

        update_job_candidate_interview_questions(
            candidate_id,
            "\n".join(questions)
        )

        return {
            "message": "Interview questions generated successfully",
            "candidate_id": candidate_id,
            "questions": questions
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@app.patch(
    "/jobs/{job_id}/candidates/{candidate_id}/interview"
)
def update_candidate_interview(
    job_id: int,
    candidate_id: int,
    data: InterviewRequest,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    candidate = get_job_candidate_by_id(
        candidate_id,
        job_id
    )

    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    update_job_candidate_interview(
        candidate_id,
        data.interview_date,
        data.interview_time,
        data.interview_type,
        data.interviewer,
        data.interview_status,
        data.interview_notes
    )

    return {
        "message": "Interview details updated successfully",
        "candidate_id": candidate_id,
        "interview_date": data.interview_date,
        "interview_time": data.interview_time,
        "interview_type": data.interview_type,
        "interviewer": data.interviewer,
        "interview_status": data.interview_status,
        "interview_notes": data.interview_notes
    }

@app.get("/jobs/{job_id}/report")
def download_job_report(
    job_id: int,
    user=Depends(require_recruiter)
):

    job = get_job_by_id(
        job_id,
        user["id"]
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )


    candidates = get_job_candidates(
        job_id
    )


    output = io.StringIO()

    writer = csv.writer(
        output
    )


    writer.writerow([
        "Job Title",
        "Company",
        "Candidate Name",
        "Candidate Email",
        "Resume",
        "Match Score",
        "Skills Match",
        "Experience Match",
        "Education Match",
        "Status",
        "Matched Skills",
        "Missing Skills",
        "Notes",
        "Interview Date",
        "Interview Time",
        "Interview Type",
        "Interviewer",
        "Interview Status"
    ])


    for candidate in candidates:

        writer.writerow([
            job["title"],
            job["company"],
            candidate["candidate_name"],
            candidate["candidate_email"],
            candidate["resume_filename"],
            candidate["match_score"],
            candidate["skills_match"],
            candidate["experience_match"],
            candidate["education_match"],
            candidate["status"],
            candidate["matched_skills"],
            candidate["missing_skills"],
            candidate["notes"],
            candidate["interview_date"],
            candidate["interview_time"],
            candidate["interview_type"],
            candidate["interviewer"],
            candidate["interview_status"]
        ])


    output.seek(0)


    filename = (
        f"ResumeIQ_{job['title']}_Report.csv"
        .replace(" ", "_")
    )


    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition":
                f'attachment; filename="{filename}"'
        }
    )